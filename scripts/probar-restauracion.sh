#!/usr/bin/env bash
# Prueba de punta a punta del respaldo: crea una base con datos, la respalda, la restaura en una base
# vacía y comprueba que quedó igual y que la restricción anti-cruce sigue viva. Usa dos bases
# temporales en el mismo servidor de DATABASE_URL y las borra al terminar.
#
#   DATABASE_URL=... scripts/probar-restauracion.sh      (o: make probar-respaldo)
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGEN=sobanderia_resp_origen
DESTINO=sobanderia_resp_destino
trabajo="$(mktemp -d)"

# shellcheck source=_conexion.sh
. "$raiz/scripts/_conexion.sh"
base_url="$DATABASE_URL"
url_de() { # URL de la misma conexión con otra base
  python3 -I - "$base_url" "$1" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
u = urlsplit(sys.argv[1])
print(urlunsplit(u._replace(path="/" + sys.argv[2])))
PY
}
admin() { PGDATABASE=postgres psql --no-psqlrc -v ON_ERROR_STOP=1 -qtA "$@"; }
en() { PGDATABASE="$1" psql --no-psqlrc -v ON_ERROR_STOP=1 -qtA "${@:2}"; }

limpiar() {
  admin -c "DROP DATABASE IF EXISTS $ORIGEN" -c "DROP DATABASE IF EXISTS $DESTINO" > /dev/null 2>&1 || true
  rm -rf "$trabajo"
}
trap limpiar EXIT
fallo() { echo "FALLÓ: $*" >&2; exit 1; }
paso() { echo "== $*"; }

paso "1. Base de origen con esquema, datos de ejemplo y citas"
admin -c "DROP DATABASE IF EXISTS $ORIGEN" -c "DROP DATABASE IF EXISTS $DESTINO"
admin -c "CREATE DATABASE $ORIGEN" -c "CREATE DATABASE $DESTINO"
url_origen="$(url_de $ORIGEN)"
(
  cd "$raiz/apps/api"
  export DATABASE_URL="$url_origen" ENTORNO=desarrollo SEED_CLAVE=clave-de-respaldo-1
  alembic upgrade head > /dev/null
  python3 -m app.seed > /dev/null
)
en $ORIGEN > /dev/null <<'SQL'
INSERT INTO clientes (nombre, celular, politica_aceptada_en, politica_version)
VALUES ('Cliente Respaldo', '+573001112233', now(), 'borrador-1');
INSERT INTO citas (sobandero_id, cliente_id, rango, estado, origen)
SELECT 1, c.id, tstzrange(t.ini, t.ini + interval '30 minutes', '[)'), 'agendada', 'cliente'
FROM clientes c, (VALUES ('2031-03-04 15:00+00'::timestamptz), ('2031-03-04 16:00+00')) AS t(ini)
WHERE c.celular = '+573001112233';
SQL
citas_origen="$(en $ORIGEN -c 'SELECT count(*) FROM citas')"
[ "$citas_origen" -ge 2 ] || fallo "el origen no tiene citas"

paso "2. Respaldo (con retención: un archivo viejo del mismo nombre se borra, otros no)"
mkdir -p "$trabajo/respaldos"
touch -d '20 days ago' "$trabajo/respaldos/sobanderia-viejo.dump" "$trabajo/respaldos/notas.txt"
archivo="$(RESPALDOS_DIR="$trabajo/respaldos" "$raiz/scripts/respaldo.sh" "$url_origen" 2> "$trabajo/respaldo.err")"
cat "$trabajo/respaldo.err"
[ -f "$archivo" ] || fallo "no se creó el respaldo"
[ ! -e "$trabajo/respaldos/sobanderia-viejo.dump" ] || fallo "el respaldo vencido no se borró"
[ -e "$trabajo/respaldos/notas.txt" ] || fallo "se borró un archivo que no era un respaldo"
[ "$(stat -c %a "$archivo")" = "600" ] || fallo "el respaldo no es privado (0600)"
if grep -q 'clave-de-respaldo-1' "$trabajo/respaldo.err"; then fallo "una clave apareció en la salida"; fi

paso "3. Restaurar en una base vacía"
url_destino="$(url_de $DESTINO)"
DATABASE_URL="$url_destino" "$raiz/scripts/restaurar.sh" "$archivo"

paso "4. La base restaurada es igual, fila por fila"
resumen() { # una línea por tabla: nombre, filas y huella del contenido
  for t in $(en "$1" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"); do
    echo "$t $(en "$1" -c "SELECT count(*) || ' ' || coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), '-') FROM \"$t\" x")"
  done
}
resumen $ORIGEN > "$trabajo/origen.txt"
resumen $DESTINO > "$trabajo/destino.txt"
[ -s "$trabajo/origen.txt" ] || fallo "no se pudo leer el origen"
diff "$trabajo/origen.txt" "$trabajo/destino.txt" || fallo "las bases no son iguales"
echo "$(wc -l < "$trabajo/origen.txt") tablas idénticas."

paso "5. La restricción anti-cruce y la extensión siguen vivas"
[ "$(en $DESTINO -c "SELECT count(*) FROM pg_extension WHERE extname='btree_gist'")" = "1" ] \
  || fallo "falta btree_gist"
if salida="$(en $DESTINO -c "INSERT INTO citas (sobandero_id, cliente_id, rango, estado, origen) SELECT 1, id, tstzrange('2031-03-04 15:10+00','2031-03-04 15:40+00','[)'), 'agendada', 'cliente' FROM clientes LIMIT 1" 2>&1)"; then
  fallo "la base restaurada aceptó una cita cruzada"
fi
echo "$salida" | grep -q citas_sin_cruce || fallo "el cruce se rechazó por otro motivo: $salida"
echo "Una cita cruzada se rechaza con citas_sin_cruce."

paso "6. No se restaura encima de una base con datos"
set +e
DATABASE_URL="$url_destino" "$raiz/scripts/restaurar.sh" "$archivo" 2> "$trabajo/encima.err"
codigo=$?
set -e
[ "$codigo" = "2" ] || fallo "restauró sobre una base con datos (código $codigo)"
cat "$trabajo/encima.err"
[ "$(en $DESTINO -c 'SELECT count(*) FROM citas')" = "$citas_origen" ] || fallo "se alteró la base"
if DATABASE_URL="$url_destino" "$raiz/scripts/restaurar.sh" /nada.dump 2> /dev/null; then fallo "aceptó un archivo inexistente"; fi
echo "mal-archivo" > "$trabajo/falso.dump"
if DATABASE_URL="$url_destino" "$raiz/scripts/restaurar.sh" "$trabajo/falso.dump" 2> /dev/null; then fallo "aceptó un archivo que no es respaldo"; fi

paso "6b. Con --forzar sí restaura encima (y la base vuelve a quedar igual al origen)"
en $DESTINO -c "DELETE FROM citas" > /dev/null
DATABASE_URL="$url_destino" "$raiz/scripts/restaurar.sh" "$archivo" --forzar
resumen $DESTINO > "$trabajo/destino2.txt"
diff "$trabajo/origen.txt" "$trabajo/destino2.txt" || fallo "tras --forzar la base no quedó igual"

paso "7. Una URL rota detiene todo (no hereda variables PG* de otra base)"
if DATABASE_URL="esto-no-es-una-url" "$raiz/scripts/restaurar.sh" "$archivo" --forzar 2> /dev/null; then
  fallo "siguió adelante con una URL inválida"
fi
[ "$(en $DESTINO -c 'SELECT count(*) FROM citas')" = "$citas_origen" ] || fallo "se alteró la base"

echo
echo "RESTAURACIÓN PROBADA: $citas_origen citas y $(wc -l < "$trabajo/origen.txt") tablas idénticas en una base vacía."
