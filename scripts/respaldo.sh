#!/usr/bin/env bash
# Copia de seguridad de la base: un archivo .dump (formato personalizado de pg_dump), verificado y
# con retención. Pensado para correr una vez al día.
#
#   DATABASE_URL=... scripts/respaldo.sh
#
# Variables opcionales: RESPALDOS_DIR (por defecto ./respaldos), RETENCION_DIAS (por defecto 14).
# Escribe el nombre del archivo creado en la salida estándar; los avisos van a la de error.
set -euo pipefail
umask 077

aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_conexion.sh
. "$aqui/_conexion.sh" "${1:-}"

carpeta="${RESPALDOS_DIR:-./respaldos}"
retencion="${RETENCION_DIAS:-14}"
case "$retencion" in '' | *[!0-9]*) echo "RETENCION_DIAS debe ser un número." >&2; exit 1 ;; esac
mkdir -p "$carpeta"
chmod 700 "$carpeta"

sello="$(date -u +%Y%m%d-%H%M%SZ)"
destino="$carpeta/sobanderia-$sello.dump"
temporal="$destino.parcial"
trap 'rm -f "$temporal"' EXIT

pg_dump --format=custom --no-owner --no-privileges --file="$temporal"
# Un respaldo que no se puede leer no es un respaldo: se comprueba antes de darlo por bueno.
pg_restore --list "$temporal" > /dev/null
mv "$temporal" "$destino"
echo "Respaldo creado: $destino ($(du -h "$destino" | cut -f1))" >&2

# Retención: solo se borran archivos con el nombre de estos respaldos y de más de N días.
find "$carpeta" -maxdepth 1 -type f -name 'sobanderia-*.dump' -mtime "+$retencion" -print -delete \
  | sed 's/^/Respaldo vencido borrado: /' >&2 || true

echo "$destino"
