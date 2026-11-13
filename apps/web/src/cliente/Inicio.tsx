import { Button, OptionRow, SummaryCard, type SummaryCardItem } from "../componentes/ui";
import { formatearCelular } from "../lib/celular";
import { PantallaCliente } from "./Disposicion";
import { useNegocio } from "./consultas";
import { useNavigate } from "react-router-dom";

/** Pantalla `Inicio` del lienzo. Los datos del local llegan de la API; si no cargan, la pantalla sigue sirviendo. */
export function Inicio() {
  const navigate = useNavigate();
  const negocio = useNegocio().data;
  const datos: SummaryCardItem[] = negocio ? [{ icon: "phone", text: formatearCelular(negocio.telefono) }] : [];

  return (
    <PantallaCliente
      pie={
        <>
          <Button to="/agendar" icon="calendar-check" block>
            Agendar mi cita
          </Button>
          <Button to="/encontrar-cita" variant="outline" block>
            Ya tengo una cita
          </Button>
        </>
      }
    >
      <span className="section-title sb-cl__marca">{negocio?.nombre ?? "Sobandería"}</span>
      <h1 className="display-lg">Agende su cita en un minuto</h1>
      <p className="body-lg">Escoja con quién y cuándo. No necesita crear cuenta.</p>
      {datos.length > 0 ? <SummaryCard items={datos} label="Datos del local" /> : null}
      {negocio?.direccion ? <p className="caption sb-muted">{negocio.direccion}</p> : null}
      <OptionRow
        title="Tenga la app a la mano"
        caption="Agréguela a su pantalla de inicio"
        icon="plus"
        onClick={() => navigate("/instalar")}
      />
    </PantallaCliente>
  );
}
