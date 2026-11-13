Botón «Atrás» para las pantallas de detalle, con flecha y texto.

Quien lo usa aporta `onBack` y, si hace falta, `label` (por defecto «Atrás»). Va arriba de la pantalla, antes del título `display-lg`, con `space-16` de margen lateral de 20px.

- Mide al menos 48px de alto, texto `body-lg` en `brand-deep`, con anillo de foco.
- Úsalo en pantallas de detalle (cita, ficha, formulario). En los pasos del agendamiento va `StepHeader`, que ya incluye «Atrás».
- Evítalo: poner otro texto que no sea de navegación; para cerrar una acción se usa un `Button`.
