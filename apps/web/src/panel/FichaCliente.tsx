import { useNavigate, useParams } from "react-router-dom";

import { BackHeader, Button, OptionRow, SummaryCard } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { formatearCelular } from "../lib/celular";
import { enlaceLlamar, enlaceWhatsapp } from "../lib/contacto";
import { diaBogota } from "../lib/fechas";
import { useFichaCliente, type FichaCliente } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { FilaCita } from "./FilaCita";
import { ESTADO_CITA, fechaCorta, mesYAnio, textoHora } from "./formato";
import { useAtras } from "./navegacion";

/** Pantalla `Cliente` del lienzo: datos, próximas citas e historial con este sobandero. */
export function Cliente() {
  const id = Number(useParams().id);
  const consulta = useFichaCliente(id);
  return (
    <Cargable consulta={consulta} texto="Buscando al cliente…">
      {(ficha) => <Ficha ficha={ficha} />}
    </Cargable>
  );
}

function Ficha({ ficha }: { ficha: FichaCliente }) {
  const navigate = useNavigate();
  const atras = useAtras("/panel/clientes");
  return (
    <PantallaPanel
      cabecera={<BackHeader onBack={atras} />}
      pie={
        <Button
          icon="plus"
          onClick={() => navigate("/panel/nueva-cita", { state: { nombre: ficha.nombre, celular: ficha.celular } })}
          block
        >
          Agendar nueva cita
        </Button>
      }
    >
      <h1 className="display-lg">{ficha.nombre}</h1>
      <SummaryCard
        label="Datos del cliente"
        items={[
          { icon: "phone", text: formatearCelular(ficha.celular) },
          { icon: "calendar-check", text: `Cliente desde ${mesYAnio(ficha.cliente_desde)}` },
          { icon: "users", text: ficha.total === 1 ? "1 cita en total" : `${ficha.total} citas en total` },
        ]}
      />
      <div className="sb-pn__fila">
        <Button variant="outline" icon="phone" href={enlaceLlamar(ficha.celular)}>
          Llamar
        </Button>
        <Button variant="outline" icon="chat" href={enlaceWhatsapp(ficha.celular)}>
          WhatsApp
        </Button>
      </div>

      {ficha.proximas.length > 0 ? (
        <section className="sb-pn__seccion" aria-label={ficha.proximas.length === 1 ? "Próxima cita" : "Próximas citas"}>
          <h2 className="section-title">{ficha.proximas.length === 1 ? "Próxima cita" : "Próximas citas"}</h2>
          {ficha.proximas.map((c) => (
            <FilaCita key={c.id} cita={c} />
          ))}
        </section>
      ) : null}

      {ficha.historial.length > 0 ? (
        <section className="sb-pn__seccion" aria-label="Citas anteriores">
          <h2 className="section-title">Citas anteriores</h2>
          {ficha.historial.map((c) => (
            <OptionRow
              key={c.id}
              title={fechaCorta(diaBogota(c.inicio))}
              caption={`${textoHora(c.inicio)} · ${ESTADO_CITA[c.estado] ?? c.estado}`}
              trailing="none"
            />
          ))}
        </section>
      ) : null}
    </PantallaPanel>
  );
}
