#!/usr/bin/env bash
# Restaura un respaldo en la base que indica DATABASE_URL. Se niega a tocar una base que ya tiene
# tablas, salvo con --forzar.
#
#   DATABASE_URL=... scripts/restaurar.sh respaldos/sobanderia-AAAAMMDD-HHMMSSZ.dump [--forzar]
#
# Nunca contra producción sin revisarlo antes con quien la administra: --forzar borra lo que haya.
set -euo pipefail

archivo="${1:-}"
forzar="${2:-}"
if [ -z "$archivo" ] || [ ! -f "$archivo" ]; then
  echo "Uso: scripts/restaurar.sh ARCHIVO.dump [--forzar]" >&2
  exit 1
fi
if [ -n "$forzar" ] && [ "$forzar" != "--forzar" ]; then
  echo "Opción desconocida: $forzar" >&2
  exit 1
fi

aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_conexion.sh
. "$aqui/_conexion.sh" "${DATABASE_URL:-}"

pg_restore --list "$archivo" > /dev/null || { echo "El archivo no es un respaldo válido." >&2; exit 1; }

tablas="$(psql --no-psqlrc -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
if [ "$tablas" != "0" ] && [ "$forzar" != "--forzar" ]; then
  echo "La base '$PGDATABASE' ya tiene $tablas tablas: no se restaura encima. Use una base vacía o --forzar." >&2
  exit 2
fi

opciones=(--no-owner --no-privileges --exit-on-error --dbname="$PGDATABASE")
if [ "$forzar" = "--forzar" ]; then opciones+=(--clean --if-exists); fi
pg_restore "${opciones[@]}" "$archivo"
echo "Restaurado en '$PGDATABASE' en $PGHOST." >&2
