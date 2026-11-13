import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { Cargable } from "../cliente/Disposicion";
import { BackHeader, Button, EmptyState, OptionRow, StatusNote, Switch, TextField } from "../componentes/ui";
import { diaBogota, fechaLarga } from "../lib/fechas";
import { textoDeError } from "../panel/errores";
import { citasTexto } from "../panel/formato";
import { useEditarSobandero, useEnviarEnlaceClave, useHorarioSobandero, useSobandero, type SobanderoAdmin } from "./consultas";
import { PantallaAdmin } from "./Disposicion";
import { resumenHorario } from "./formato";

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** El id de la ruta `/admin/sobanderos/:id/...`. */
export const useIdSobandero = () => Number(useParams().id);

/** Pantalla `Admin-Sobandero` del lienzo: activar o desactivar, correo, horario, duración y enlace de clave. */
export function FichaSobandero() {
  const id = useIdSobandero();
  const consulta = useSobandero(id);
  return (
    <Cargable consulta={consulta} texto="Buscando al sobandero…">
      {(s) => <Ficha key={`${s.id}-${s.correo}-${s.recibe_citas}`} sobandero={s} />}
    </Cargable>
  );
}

function Ficha({ sobandero: s }: { sobandero: SobanderoAdmin }) {
  const navigate = useNavigate();
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const horario = useHorarioSobandero(s.id);
  const editar = useEditarSobandero(s.id);
  const enlace = useEnviarEnlaceClave(s.id);
  const [recibe, setRecibe] = useState(s.recibe_citas);
  const [correo, setCorreo] = useState(s.correo);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const deBaja = !s.activo;
  const enBaja = s.activo && s.baja_en !== null;

  const guardar = () => {
    setError(null);
    setErrorCorreo(null);
    if (!CORREO.test(correo.trim())) {
      setErrorCorreo("Escriba un correo válido, por ejemplo nombre@correo.com.");
      return;
    }
    const cambios = {
      ...(correo.trim().toLowerCase() !== s.correo ? { correo: correo.trim() } : {}),
      ...(recibe !== s.recibe_citas ? { recibe_citas: recibe } : {}),
    };
    if (Object.keys(cambios).length === 0) return navigate("/admin/sobanderos");
    editar.mutate(cambios, {
      onSuccess: () => navigate("/admin/sobanderos", { state: { aviso: "Cambios guardados." } }),
      onError: (e) => (esErrorApi(e, "correo_en_uso") ? setErrorCorreo(e.message) : setError(textoDeError(e))),
    });
  };

  return (
    <PantallaAdmin
      cabecera={<BackHeader onBack={() => navigate("/admin/sobanderos")} />}
      pie={
        deBaja ? undefined : (
          <Button icon="check" onClick={guardar} disabled={editar.isPending} block>
            Guardar cambios
          </Button>
        )
      }
    >
      <h1 className="display-lg">{s.nombre}</h1>
      {aviso ? <StatusNote icon="check">{aviso}</StatusNote> : null}
      {deBaja ? (
        <EmptyState title="Está dado de baja" text="No recibe citas ni puede ingresar. Su historial se conserva." />
      ) : (
        <>
          {enBaja ? (
            <EmptyState
              title="Está en baja"
              text={`No recibe citas nuevas. Le quedan ${citasTexto(s.citas_proximas)}; al terminarlas, su cuenta se cierra sola${s.baja_en ? ` (baja del ${fechaLarga(diaBogota(s.baja_en)).toLowerCase()})` : ""}.`}
            />
          ) : (
            <Switch label="Recibe citas" checked={recibe} onChange={(e) => setRecibe(e.target.checked)} />
          )}
          <TextField label="Correo" type="email" inputMode="email" autoComplete="off" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errorCorreo ?? undefined} />
          <OptionRow
            title="Horario semanal"
            caption={horario.data ? resumenHorario(horario.data) : "Buscando el horario…"}
            icon="clock"
            onClick={() => navigate(`/admin/sobanderos/${s.id}/horario`)}
          />
          <OptionRow title="Duración de cada cita" caption={`${s.duracion_min} minutos`} icon="clock" onClick={() => navigate(`/admin/sobanderos/${s.id}/duracion`)} />
          <Button
            variant="outline"
            block
            disabled={enlace.isPending}
            onClick={() => {
              setEnviado(false);
              setError(null);
              enlace.mutate(undefined, { onSuccess: () => setEnviado(true), onError: (e) => setError(textoDeError(e)) });
            }}
          >
            Enviarle enlace para cambiar su clave
          </Button>
          {enviado ? <StatusNote icon="check">Enviamos el enlace al correo de {s.nombre}.</StatusNote> : null}
          <Button variant="outline" icon="x" block onClick={() => navigate(`/admin/sobanderos/${s.id}/baja`)}>
            Dar de baja a {s.nombre}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="body sb-pn__error">
          {error}
        </p>
      ) : null}
    </PantallaAdmin>
  );
}
