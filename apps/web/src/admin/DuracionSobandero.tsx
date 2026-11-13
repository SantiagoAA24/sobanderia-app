import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Cargable } from "../cliente/Disposicion";
import { BackHeader, Button, OptionRow } from "../componentes/ui";
import { textoDeError } from "../panel/errores";
import { useEditarSobandero, useSobandero } from "./consultas";
import { PantallaAdmin } from "./Disposicion";
import { useIdSobandero } from "./FichaSobandero";

const OPCIONES = [20, 30, 45, 60] as const;
type Duracion = (typeof OPCIONES)[number];

/** Pantalla `Duracion` del lienzo: 20, 30, 45 o 60 minutos; aplica solo a las citas nuevas. */
export function DuracionSobandero() {
  const id = useIdSobandero();
  const consulta = useSobandero(id);
  return (
    <Cargable consulta={consulta} texto="Buscando al sobandero…">
      {(s) => <Formulario id={s.id} inicial={s.duracion_min} />}
    </Cargable>
  );
}

function Formulario({ id, inicial }: { id: number; inicial: number }) {
  const navigate = useNavigate();
  const editar = useEditarSobandero(id);
  const [duracion, setDuracion] = useState<number>(inicial);
  const [error, setError] = useState<string | null>(null);
  const volver = `/admin/sobanderos/${id}`;

  const guardar = () => {
    setError(null);
    if (duracion === inicial) return navigate(volver, { replace: true });
    editar.mutate(
      { duracion_min: duracion as Duracion },
      {
        onSuccess: () => navigate(volver, { replace: true, state: { aviso: "Duración guardada. Las citas ya agendadas no cambian." } }),
        onError: (e) => setError(textoDeError(e)),
      },
    );
  };

  return (
    <PantallaAdmin
      cabecera={<BackHeader onBack={() => navigate(volver)} />}
      pie={
        <Button icon="check" onClick={guardar} disabled={editar.isPending} block>
          Guardar
        </Button>
      }
    >
      <h1 className="display-lg">Duración de cada cita</h1>
      <p className="body-lg sb-muted">Se aplica a las citas nuevas. Las ya agendadas no cambian.</p>
      {OPCIONES.map((m) => (
        <OptionRow key={m} title={`${m} minutos`} trailing="radio" selected={duracion === m} onClick={() => setDuracion(m)} />
      ))}
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaAdmin>
  );
}
