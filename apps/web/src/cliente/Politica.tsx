import { useNavigate } from "react-router-dom";

import { BackHeader, StatusNote } from "../componentes/ui";
import { PantallaCliente } from "./Disposicion";

/** Versión del texto: la misma que guarda la API (`politica_version`) cuando alguien lo acepta. */
export const VERSION_POLITICA = "borrador-1";

/**
 * Texto PROVISIONAL de la política de datos. Falta la revisión de un abogado (Ley 1581 de 2012).
 * Mientras exista el aviso «Texto pendiente de revisión legal», no debe publicarse como definitivo:
 * al recibir el texto revisado se quita el aviso y se sube la versión (aquí y en `config.py`).
 */
export function Politica() {
  const navigate = useNavigate();
  return (
    <PantallaCliente cabecera={<BackHeader onBack={() => navigate("/")} />}>
      <h1 className="display-lg">Política de datos</h1>
      <StatusNote icon="clock">Texto pendiente de revisión legal</StatusNote>
      <p className="caption sb-muted">Versión {VERSION_POLITICA}. Puede cambiar.</p>
      <h2 className="section-title">Qué datos pedimos</h2>
      <p className="body-lg">Solo su nombre y su número de celular. No le pedimos el motivo de la consulta ni datos de salud.</p>
      <h2 className="section-title">Para qué los usamos</h2>
      <p className="body-lg">Para agendar su cita y avisarle por WhatsApp: confirmación, recordatorio y cambios.</p>
      <h2 className="section-title">Quién los ve</h2>
      <p className="body-lg">La sobandería y el sobandero que le atiende. No los compartimos con nadie más.</p>
      <h2 className="section-title">Sus derechos</h2>
      <p className="body-lg">Puede pedirnos que veamos, corrijamos o borremos sus datos. Llámenos o escríbanos.</p>
    </PantallaCliente>
  );
}
