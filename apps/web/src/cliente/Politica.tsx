import { useNavigate } from "react-router-dom";

import { BackHeader } from "../componentes/ui";
import { PantallaCliente } from "./Disposicion";

/**
 * Texto PROVISIONAL de la política de datos (versión `borrador-1`, la que guarda la API).
 * Falta la revisión de un abogado (Ley 1581 de 2012); no debe publicarse como definitivo.
 */
export function Politica() {
  const navigate = useNavigate();
  return (
    <PantallaCliente cabecera={<BackHeader onBack={() => navigate("/")} />}>
      <h1 className="display-lg">Política de datos</h1>
      <p className="caption sb-muted">Borrador pendiente de revisión legal.</p>
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
