import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BackHeader, Button, StatusNote, SummaryCard } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { enlaceLlamar, enlaceWhatsapp } from "../lib/contacto";
import { formatearCelular } from "../lib/celular";
import { diaBogota, fechaLarga } from "../lib/fechas";
import { useCambiarCita, useCitaPanel, type CitaPanel } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { textoDeError } from "./errores";
import { minutosEntre, textoHora } from "./formato";
import { useAtras } from "./navegacion";

/** Pantalla `Cita` del lienzo: datos, llamar, WhatsApp, atender, cambiar la hora y cancelar. */
export function Cita() {
  const id = Number(useParams().id);
  const consulta = useCitaPanel(id);
  return (
    <Cargable consulta={consulta} texto="Buscando la cita…">
      {(cita) => <DetalleCita cita={cita} />}
    </Cargable>
  );
}

const ESTADOS: Record<string, { icono: "check" | "x"; texto: string }> = {
  atendida: { icono: "check", texto: "Atendida" },
  no_asistio: { icono: "x", texto: "No asistió" },
  cancelada: { icono: "x", texto: "Cancelada" },
};

function DetalleCita({ cita }: { cita: CitaPanel }) {
  const navigate = useNavigate();
  const atras = useAtras("/panel/hoy");
  const cambiar = useCambiarCita(cita.id);
  const [error, setError] = useState<string | null>(null);
  const agendada = cita.estado === "agendada";
  const estado = ESTADOS[cita.estado];

  const atender = () => {
    setError(null);
    cambiar.mutate(
      { estado: "atendida" },
      { onSuccess: () => navigate("/panel/hoy", { replace: true }), onError: (e) => setError(textoDeError(e)) },
    );
  };

  return (
    <PantallaPanel
      cabecera={<BackHeader onBack={atras} />}
      pie={
        agendada ? (
          <>
            <Button icon="check" onClick={atender} disabled={cambiar.isPending} block>
              Marcar como atendida
            </Button>
            {cita.puede_modificar ? (
              <Button variant="outline" icon="x" to={`/panel/citas/${cita.id}/cancelar`} block>
                Cancelar la cita
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <h1 className="display-lg">Cita de {cita.cliente.nombre}</h1>
      <SummaryCard
        label="Datos de la cita"
        items={[
          { icon: "users", text: cita.cliente.nombre },
          { icon: "calendar-check", text: fechaLarga(diaBogota(cita.inicio)) },
          { icon: "clock", text: `${textoHora(cita.inicio)} · ${minutosEntre(cita.inicio, cita.fin)} min` },
          { icon: "phone", text: formatearCelular(cita.cliente.celular) },
        ]}
      />
      {estado ? <StatusNote icon={estado.icono}>{estado.texto}</StatusNote> : null}
      <div className="sb-pn__fila">
        <Button variant="outline" icon="phone" href={enlaceLlamar(cita.cliente.celular)}>
          Llamar
        </Button>
        <Button variant="outline" icon="chat" href={enlaceWhatsapp(cita.cliente.celular)}>
          WhatsApp
        </Button>
      </div>
      {agendada && cita.puede_modificar ? (
        <Button variant="outline" icon="calendar-week" to={`/panel/citas/${cita.id}/cambiar`} block>
          Cambiar la hora
        </Button>
      ) : null}
      {agendada ? (
        <Button variant="outline" icon="x" to={`/panel/citas/${cita.id}/no-asistio`} block>
          No asistió
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaPanel>
  );
}
