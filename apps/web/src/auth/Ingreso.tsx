import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { useSesion } from "../api/sesion";
import { Button, PasswordField, StatusNote, TextField } from "../componentes/ui";
import { PantallaPanel } from "../panel/Disposicion";
import { destinoTras } from "./destino";
import { useIngresar } from "./consultas";

interface Estado {
  desde?: string;
  claveNueva?: boolean;
}

/** Pantallas `Ingreso` e `Ingreso-error` del lienzo. */
export function Ingreso() {
  const navigate = useNavigate();
  const estado = (useLocation().state ?? {}) as Estado;
  const sesion = useSesion();
  const ingresar = useIngresar();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<{ correo?: string; clave?: string; general?: string }>({});

  // Quien ya tiene sesión no necesita ver esta pantalla.
  if (sesion.data && !ingresar.isPending) {
    return <Navigate to={sesion.data.debe_cambiar_clave ? "/primera-clave" : destinoTras(sesion.data, estado.desde)} replace />;
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos: typeof errores = {};
    if (!correo.trim()) nuevos.correo = "Escriba su correo.";
    if (!clave) nuevos.clave = "Escriba su clave.";
    setErrores(nuevos);
    if (nuevos.correo || nuevos.clave) return;
    ingresar.mutate(
      { correo: correo.trim(), clave },
      {
        onSuccess: ({ usuario }) =>
          navigate(usuario.debe_cambiar_clave ? "/primera-clave" : destinoTras(usuario, estado.desde), { replace: true }),
        onError: (e) => {
          if (esErrorApi(e) && e.estado === 401) setErrores({ clave: `${e.message} Revise e inténtelo de nuevo.` });
          else if (esErrorApi(e)) setErrores({ general: e.message });
          else setErrores({ general: "No hay conexión. Revise su internet e inténtelo de nuevo." });
        },
      },
    );
  };

  return (
    <form onSubmit={enviar} noValidate>
      <PantallaPanel
        pie={
          <>
            <Button type="submit" icon="check" disabled={ingresar.isPending} block>
              Entrar
            </Button>
            <p className="caption sb-muted sb-pn__nota">
              ¿Va a agendar una cita? No necesita cuenta. <Link to="/agendar">Agende aquí</Link>
            </p>
          </>
        }
      >
        <span className="section-title sb-pn__marca">Sobandería</span>
        <h1 className="display-lg">Ingrese a su cuenta</h1>
        {estado.claveNueva ? <StatusNote>Su clave cambió. Ingrese con la clave nueva.</StatusNote> : null}
        <TextField
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
        />
        <PasswordField label="Clave" value={clave} onChange={(e) => setClave(e.target.value)} error={errores.clave} />
        <Link to="/olvide-clave" className="body-lg sb-pn__enlace">
          ¿Olvidó su clave?
        </Link>
        {errores.general ? (
          <p role="alert" className="body sb-pn__error">
            {errores.general}
          </p>
        ) : null}
      </PantallaPanel>
    </form>
  );
}
