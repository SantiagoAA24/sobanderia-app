import { configureAxe } from "vitest-axe";

/** axe sin la regla de contraste (jsdom no calcula estilos); el contraste se prueba en estilos/contraste.test.ts. */
export const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });
