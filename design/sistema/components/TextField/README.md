Campo de texto con etiqueta visible arriba y ayuda opcional debajo.

Quien lo usa aporta `label` (obligatoria), `value` y `onChange` (o `defaultValue`), `type` e `inputMode` (por ejemplo `tel` para el celular), `autoComplete` y, si ayuda, `helper`. Con `error` el borde pasa a `brand-deep` de 2px y el mensaje reemplaza a la ayuda, en negrita y sin depender solo del color.

- Alto de 56px, borde de 2px `ink-muted` y esquinas `radius-lg`; el foco usa el anillo `focus-ring`.
- La etiqueta siempre está visible: no uses el placeholder como etiqueta.
- La ayuda explica para qué se pide el dato ("Le enviaremos la confirmación por WhatsApp.").
- Hazlo así: un dato por campo y etiquetas en lenguaje simple ("Número de celular").
- Evítalo: campos sin etiqueta o textos de ayuda largos.
- Mensajes de error en tono amable y concretos: «Escriba los 10 dígitos de su celular», no «Dato inválido».
