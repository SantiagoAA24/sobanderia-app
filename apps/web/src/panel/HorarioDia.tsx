import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useId } from "react";

import { BackHeader, Button, IconButton, Switch } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { useGuardarHorario, useHorario, type DiaHorario } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { textoDeError } from "./errores";
import { aHhmm, aMinutos, nombreDiaSemana, opcionesDeHora, textoHhmm } from "./formato";
import { SEGMENTOS_DIA } from "./Horario";

type Franja = DiaHorario["franjas"][number];
const MAX_FRANJAS = 4;
const HORAS = opcionesDeHora("05:00", "21:00");

/** Pantalla `Horario-dia` del lienzo: si atiende ese día y sus franjas. */
export function HorarioDia() {
  const indice = SEGMENTOS_DIA.indexOf(useParams().dia as (typeof SEGMENTOS_DIA)[number]);
  const horario = useHorario();
  const guardar = useGuardarHorario();
  if (indice < 0) return <Navigate to="/panel/horario" replace />;
  return (
    <Cargable consulta={horario} texto="Buscando su horario…">
      {(h) => (
        <FormularioDia
          indice={indice}
          inicial={h.dias.find((d) => d.dia_semana === indice)?.franjas ?? []}
          volverA="/panel/horario"
          guardador={guardar}
        />
      )}
    </Cargable>
  );
}

function Selector({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="sb-field">
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <select id={id} className="sb-field__input body-lg sb-pn__select" value={valor} onChange={(e) => onChange(e.target.value)}>
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {textoHhmm(h)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Lo que necesita el formulario para guardar: la mutación del sobandero o la del administrador. */
export interface Guardador {
  isPending: boolean;
  mutate: (dias: DiaHorario[], opciones: { onSuccess: () => void; onError: (e: unknown) => void }) => void;
}

/** Si atiende ese día y sus franjas. Al guardar vuelve a `volverA`. */
export function FormularioDia({ indice, inicial, volverA, guardador: guardar }: { indice: number; inicial: Franja[]; volverA: string; guardador: Guardador }) {
  const navigate = useNavigate();
  const nombre = nombreDiaSemana(indice);
  const [franjas, setFranjas] = useState<Franja[]>(inicial);
  const [error, setError] = useState<string | null>(null);
  const atiende = franjas.length > 0;

  const cambiar = (i: number, campo: keyof Franja, valor: string) =>
    setFranjas((actual) => actual.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  /** La franja nueva empieza donde terminó la última (o a las 8:00) y dura dos horas, sin pasar de las 9:00 p. m. */
  const agregar = () =>
    setFranjas((actual) => {
      const ultimo = actual.at(-1);
      const desde = ultimo ? ultimo.hasta : "08:00";
      const hasta = aHhmm(Math.min(aMinutos(desde) + 120, aMinutos("21:00")));
      return [...actual, { desde, hasta }];
    });

  const enviar = () => {
    setError(null);
    for (const f of franjas) {
      if (aMinutos(f.hasta) <= aMinutos(f.desde)) {
        setError("Cada franja debe terminar después de empezar.");
        return;
      }
    }
    guardar.mutate([{ dia_semana: indice, franjas }], {
      onSuccess: () => navigate(volverA, { replace: true }),
      onError: (e) => setError(textoDeError(e)),
    });
  };

  return (
    <PantallaPanel
      cabecera={<BackHeader onBack={() => navigate(volverA)} />}
      pie={
        <Button icon="check" onClick={enviar} disabled={guardar.isPending} block>
          Guardar horario
        </Button>
      }
    >
      <h1 className="display-lg">{nombre}</h1>
      <Switch
        label={`Atiendo los ${nombre.toLowerCase()}`}
        checked={atiende}
        onChange={(e) => setFranjas(e.target.checked ? [{ desde: "08:00", hasta: "12:00" }] : [])}
      />
      {atiende ? (
        <section className="sb-pn__seccion" aria-label="Franjas">
          <h2 className="section-title">Franjas</h2>
          {franjas.map((f, i) => (
            <div key={i} className="sb-pn__franja" role="group" aria-label={`Franja ${i + 1}`}>
              <div className="sb-pn__franja-cab">
                <span className="body-lg">Franja {i + 1}</span>
                <IconButton icon="x" label={`Quitar la franja ${i + 1}`} onClick={() => setFranjas((a) => a.filter((_, j) => j !== i))} />
              </div>
              <div className="sb-pn__franja-campos">
                <Selector etiqueta="Desde" valor={f.desde} onChange={(v) => cambiar(i, "desde", v)} />
                <Selector etiqueta="Hasta" valor={f.hasta} onChange={(v) => cambiar(i, "hasta", v)} />
              </div>
            </div>
          ))}
          {franjas.length < MAX_FRANJAS ? (
            <Button variant="outline" icon="plus" onClick={agregar} block>
              Agregar otra franja
            </Button>
          ) : null}
        </section>
      ) : (
        <p className="body-lg sb-muted">No atiende este día. Las citas ya agendadas no cambian.</p>
      )}
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaPanel>
  );
}
