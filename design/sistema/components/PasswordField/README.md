Campo de clave con botón «Mostrar» u «Ocultar», pensado para personas que escriben despacio o se equivocan con los puntos.

Quien lo usa aporta `label`, `value` y `onChange` (o `defaultValue`), `error`, `helper` y `autoComplete` (`current-password` al ingresar, `new-password` al crearla).

- Misma altura (56px), borde y foco que `TextField`; el botón mide 48px y va dentro del campo, a la derecha.
- Con `error`, el borde pasa a `brand-deep` y el mensaje reemplaza a la ayuda.
- Hazlo así: mensajes que dicen qué hacer («La clave no es correcta. Inténtelo de nuevo.»).
- Evítalo: pedir confirmación de clave en pantallas de ingreso.
