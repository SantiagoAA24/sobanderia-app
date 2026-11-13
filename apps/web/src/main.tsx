import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/latin-700.css";
import "./estilos/tokens.css";
import "./estilos/base.css";
import { registrarPwa } from "./registrarPwa";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registrarPwa();
