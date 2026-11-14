# Copias de seguridad y restauración

Contenido de la base: citas, clientes (nombre y celular) y cuentas. Es la única pieza con estado; el resto se reconstruye desde el repositorio.

## Respaldo diario

```bash
DATABASE_URL=postgresql+psycopg://usuario:clave@servidor:5432/sobanderia scripts/respaldo.sh
```

- Crea `respaldos/sobanderia-AAAAMMDD-HHMMSSZ.dump` (formato personalizado de `pg_dump`, permisos 0600, carpeta 0700) y comprueba que se puede leer antes de darlo por bueno.
- Borra los respaldos de más de 14 días (`RETENCION_DIAS`) y solo los que tienen ese nombre. La carpeta se cambia con `RESPALDOS_DIR`.
- La clave de la base nunca viaja en la línea de comandos: se pasa por variables de entorno de `libpq`.
- **Programarlo y sacar los archivos del servidor es de la Fase 11** (depende del hosting): una copia que vive solo en la misma máquina que la base no protege de perder la máquina. Con Azure Database for PostgreSQL, las copias automáticas del servicio pueden reemplazar o complementar este script.

## Restaurar

```bash
DATABASE_URL=postgresql+psycopg://usuario:clave@servidor:5432/base_vacia scripts/restaurar.sh respaldos/sobanderia-AAAAMMDD-HHMMSSZ.dump
```

- Se niega si el archivo no es un respaldo válido o si la base ya tiene tablas. `--forzar` restaura encima y borra lo que hubiera: **no usarlo contra producción sin revisarlo con quien la administra.**
- Después de restaurar, ejecutar `make migrate` por si el respaldo es de una versión anterior del esquema.

## Prueba de restauración

```bash
DATABASE_URL=postgresql+psycopg://sobanderia:sobanderia@localhost:5432/sobanderia make probar-respaldo
```

Crea dos bases temporales (`sobanderia_resp_origen` y `sobanderia_resp_destino`), carga esquema, datos de ejemplo y citas, y comprueba:

1. el respaldo se crea, es privado, y la retención borra un respaldo viejo pero no un archivo ajeno;
2. restaurar en una base vacía deja las 14 tablas **idénticas fila por fila** (conteo y huella del contenido);
3. `btree_gist` y `citas_sin_cruce` siguen vivos: una cita cruzada se rechaza;
4. no se restaura encima de una base con datos, ni un archivo inexistente o falso;
5. `--forzar` sí restaura encima, y una URL inválida detiene todo sin tocar otra base.

Corre en la CI. Antes del lanzamiento hay que repetirla además **con una copia real del servidor de producción** restaurada en una base aparte; esa parte no se puede hacer desde el repositorio.
