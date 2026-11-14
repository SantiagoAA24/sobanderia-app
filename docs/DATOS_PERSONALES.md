# Datos personales de los clientes (Ley 1581 de 2012)

Lo que se guarda de un cliente: nombre y celular (formato E.164), la fecha y la versión de la política que aceptó, y sus citas. No se pide el motivo de la consulta ni datos de salud.

**El texto de la política (`/politica`) es un borrador y muestra el aviso «Texto pendiente de revisión legal».** Cuando llegue el texto revisado: se reemplaza `Politica.tsx`, se quita el aviso y se sube la versión en `VERSION_POLITICA` (web) y `politica_version` (`apps/api/app/config.py`). Esto no es asesoría legal.

## Atender una solicitud de una persona

Se ejecutan en el servidor, con la misma configuración que la API (`DATABASE_URL`). Ninguna imprime el celular completo.

```bash
cd apps/api
python -m app.cli_datos exportar --celular 300XXXXXXX --salida /ruta/segura/cliente.json
python -m app.cli_datos anonimizar --celular 300XXXXXXX
python -m app.cli_datos anonimizar --celular 300XXXXXXX --confirmar
```

- **`exportar`** guarda en un archivo nuevo (permisos 0600, no sobrescribe) el cliente, sus citas y sus mensajes, sin tokens. Se entrega a la persona por un canal seguro y luego se borra el archivo.
- **`anonimizar`** sin `--confirmar` solo muestra lo que haría. Con `--confirmar`:
  - el nombre pasa a «Cliente anonimizado» y el celular a un número inerte (`+999…`);
  - los mensajes de la bandeja pierden el nombre y el token, y los enlaces de sus citas dejan de servir;
  - se borran los intentos de «Encontrar mi cita» guardados con el hash de su celular;
  - las citas se conservan (el historial y las cifras no cambian).
- Si la persona tiene citas agendadas por venir, se detiene. Con `--cancelar-citas-futuras` las cancela **sin avisar** (el aviso iría al número que se está borrando); conviene avisarle antes por otro medio.
- Cada orden deja una fila en `auditoria` (`cliente_exportado`, `cliente_anonimizado`) sin nombre ni celular.

## Lo que el comando no cubre

- **Las copias de seguridad** guardan los datos anteriores hasta que vencen (14 días). Una solicitud de supresión queda plenamente efectiva cuando venza la última copia que la contiene.
- **El historial de WhatsApp** en el teléfono del negocio y en Meta está fuera de esta base.
