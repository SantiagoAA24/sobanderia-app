import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { esHoraOcupada } from "../api/errores";
import { BackHeader, Button, CheckboxField, SummaryCard } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { diaBogota } from "../lib/fechas";
import { PantallaCierre } from "../transversales/PantallaCierre";
import { PANEL, useCambiarCita, useCitaPanel, type CitaPanel } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { ElegirDiaHora, type DiaHora } from "./ElegirDiaHora";
import { textoDeError } from "./errores";
import { diaYHora, minutosEntre, textoHora } from "./formato";

const rutaCita = (id: number) => `/panel/citas/${id}`;

/** Carga la cita de la ruta y deja pasar a la pantalla solo si todavía se puede cambiar. */
function ConCita({ puedeCambiar = true, children }: { puedeCambiar?: boolean; children: (cita: CitaPanel) => React.ReactNode }) {
  const id = Number(useParams().id);
  const consulta = useCitaPanel(id);
  return (
    <Cargable consulta={consulta} texto="Buscando la cita…">
      {(cita) =>
        (puedeCambiar ? cita.puede_modificar : cita.estado === "agendada") ? children(cita) : <Navigate to={rutaCita(cita.id)} replace />
      }
    </Cargable>
  );
}

function resumen(cita: CitaPanel) {
  const hoy = diaBogota(new Date());
  return [
    { icon: "users", text: cita.cliente.nombre },
    { icon: "calendar-check", text: diaYHora(cita.inicio, hoy) },
    { icon: "clock", text: `${minutosEntre(cita.inicio, cita.fin)} min` },
  ] as const;
}

/** Pantalla `Reprogramar` del lienzo: nuevo día y hora, con casilla para avisar por WhatsApp. */
export function Reprogramar() {
  return <ConCita>{(cita) => <FormularioReprogramar cita={cita} />}</ConCita>;
}

function FormularioReprogramar({ cita }: { cita: CitaPanel }) {
  const navigate = useNavigate();
  const cliente = useQueryClient();
  const cambiar = useCambiarCita(cita.id);
  const [eleccion, setEleccion] = useState<DiaHora>({ dia: null, inicio: null });
  const [avisar, setAvisar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (!eleccion.inicio) return;
    setError(null);
    cambiar.mutate(
      { inicio: eleccion.inicio, avisar },
      {
        onSuccess: () => navigate("/panel/hoy", { replace: true }),
        onError: (e) => {
          if (esHoraOcupada(e)) {
            setError("Esa hora ya se ocupó. Elija otra, por favor.");
            setEleccion({ dia: eleccion.dia, inicio: null });
            void cliente.invalidateQueries({ queryKey: [PANEL, "horas"] });
          } else setError(textoDeError(e));
        },
      },
    );
  };

  return (
    <PantallaPanel
      cabecera={<BackHeader onBack={() => navigate(rutaCita(cita.id))} />}
      pie={
        <Button icon="check" onClick={guardar} disabled={!eleccion.inicio || cambiar.isPending} block>
          Guardar cambio
        </Button>
      }
    >
      <h1 className="display-lg">Cambiar la hora</h1>
      <SummaryCard label="Cita actual" items={[...resumen(cita)]} />
      <ElegirDiaHora valor={eleccion} onChange={setEleccion} excluirCita={cita.id} />
      <CheckboxField label="Avisarle por WhatsApp" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaPanel>
  );
}

/** Pantalla `No-asistio` del lienzo: queda en el historial y no se avisa al cliente. */
export function NoAsistio() {
  return <ConCita puedeCambiar={false}>{(cita) => <ConfirmarNoAsistio cita={cita} />}</ConCita>;
}

function ConfirmarNoAsistio({ cita }: { cita: CitaPanel }) {
  const navigate = useNavigate();
  const cambiar = useCambiarCita(cita.id);
  const [error, setError] = useState<string | null>(null);
  const confirmar = () => {
    setError(null);
    cambiar.mutate(
      { estado: "no_asistio" },
      { onSuccess: () => navigate("/panel/hoy", { replace: true }), onError: (e) => setError(textoDeError(e)) },
    );
  };
  return (
    <PantallaPanel
      cabecera={<BackHeader onBack={() => navigate(rutaCita(cita.id))} />}
      pie={
        <>
          <Button icon="check" onClick={confirmar} disabled={cambiar.isPending} block>
            Sí, no asistió
          </Button>
          <Button variant="outline" to={rutaCita(cita.id)} block>
            Volver
          </Button>
        </>
      }
    >
      <h1 className="display-lg">¿Marcar que no asistió?</h1>
      <SummaryCard label="Cita" items={[...resumen(cita)]} />
      <p className="body-lg">Quedará en su historial. No se le avisa.</p>
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaPanel>
  );
}

/** Pantalla `Cancelar-sobandero` del lienzo: la acción principal es conservar la cita. */
export function CancelarSobandero() {
  return <ConCita>{(cita) => <ConfirmarCancelar cita={cita} />}</ConCita>;
}

function ConfirmarCancelar({ cita }: { cita: CitaPanel }) {
  const navigate = useNavigate();
  const cambiar = useCambiarCita(cita.id);
  const [avisar, setAvisar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelar = () => {
    setError(null);
    cambiar.mutate(
      { estado: "cancelada", avisar },
      {
        onSuccess: () => navigate(`${rutaCita(cita.id)}/cancelada`, { replace: true, state: { avisado: avisar } }),
        onError: (e) => setError(textoDeError(e)),
      },
    );
  };
  return (
    <PantallaPanel
      cabecera={<BackHeader onBack={() => navigate(rutaCita(cita.id))} />}
      pie={
        <>
          <Button icon="check" to={rutaCita(cita.id)} block>
            No, conservar la cita
          </Button>
          <Button variant="outline" icon="x" onClick={cancelar} disabled={cambiar.isPending} block>
            Sí, cancelar la cita
          </Button>
        </>
      }
    >
      <h1 className="display-lg">¿Cancelar la cita de {cita.cliente.nombre}?</h1>
      <SummaryCard label="Cita" items={[...resumen(cita)]} />
      <CheckboxField label="Avisarle por WhatsApp y ofrecerle otra hora" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaPanel>
  );
}

/** Pantalla `Cita-cancelada` del lienzo: la hora quedó libre y se ofrece darle otra. */
export function CitaCancelada() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const avisado = (useLocation().state as { avisado?: boolean } | null)?.avisado ?? true;
  const consulta = useCitaPanel(id);
  return (
    <Cargable consulta={consulta} texto="Un momento…">
      {(cita) =>
        cita.estado !== "cancelada" ? (
          <Navigate to={rutaCita(cita.id)} replace />
        ) : (
          <PantallaCierre
            icon="check"
            title="Cita cancelada"
            text={`${avisado ? `Le avisamos a ${cita.cliente.nombre} por WhatsApp.` : `No se le avisó a ${cita.cliente.nombre}.`} La hora de las ${textoHora(cita.inicio)} quedó libre.`}
          >
            <Button to="/panel/hoy" block>
              Volver a Hoy
            </Button>
            <Button
              variant="outline"
              icon="plus"
              onClick={() => navigate("/panel/nueva-cita", { state: { nombre: cita.cliente.nombre, celular: cita.cliente.celular } })}
              block
            >
              Darle otra hora
            </Button>
          </PantallaCierre>
        )
      }
    </Cargable>
  );
}
