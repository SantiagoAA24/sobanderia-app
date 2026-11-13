import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

// Vitest no tiene globals activados, así que Testing Library no limpia solo.
afterEach(cleanup);

// jsdom no implementa canvas y axe lo consulta para detectar iconos de fuente; sin él devuelve «no aplica».
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
