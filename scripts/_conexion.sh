# Lee DATABASE_URL (formato SQLAlchemy, p. ej. postgresql+psycopg://usuario:clave@host:5432/base) y
# exporta las variables PG* de libpq. Así la clave no viaja en la línea de comandos (se vería con `ps`).
#   . scripts/_conexion.sh            usa DATABASE_URL
#   . scripts/_conexion.sh "<url>"    usa esa URL
url="${1:-${DATABASE_URL:-}}"
if [ -z "$url" ]; then
  echo "Falta DATABASE_URL." >&2
  return 1 2>/dev/null || exit 1
fi
# Se calcula primero y se comprueba: un error de `eval "$(...)"` no detiene nada por sí solo, y las
# variables PG* que ya hubiera en el entorno apuntarían a otra base sin que nadie se enterara.
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSSLMODE
if ! exportaciones="$(python3 -I - "$url" <<'PY'
import shlex, sys
from urllib.parse import unquote, urlsplit

u = urlsplit(sys.argv[1])
if not u.scheme.startswith("postgres") or not u.path.strip("/"):
    sys.exit("DATABASE_URL no es una URL de PostgreSQL con base de datos.")
for nombre, valor in (
    ("PGHOST", u.hostname or "localhost"),
    ("PGPORT", str(u.port or 5432)),
    ("PGUSER", unquote(u.username or "")),
    ("PGPASSWORD", unquote(u.password or "")),
    ("PGDATABASE", u.path.strip("/")),
):
    print(f"export {nombre}={shlex.quote(valor)}")
PY
)"; then
  return 1 2>/dev/null || exit 1
fi
eval "$exportaciones"
