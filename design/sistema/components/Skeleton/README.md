Bloque arena que ocupa el lugar de un contenido mientras carga.

Quien lo usa aporta `width` y `height` (por defecto 100% × 60px). Se repite para imitar filas y botones.

- Fondo `surface-sand`, esquinas `radius-lg` y oculto a lectores de pantalla (`aria-hidden`).
- Acompáñalo siempre de un texto visible que diga qué se carga, por ejemplo «Buscando horas libres…», con `role="status"`.
- Evítalo: animaciones que no respeten «reducir movimiento»; por ahora es estático.
