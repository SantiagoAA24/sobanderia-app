import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { BackHeader, Button, OptionRow, PasswordField, StatusNote, TextField } from "../componentes/ui";
import { CLAVE_MINIMO } from "../auth/PrimeraClave";
import { useCambiarClave, useSalir } from "../auth/consultas";
import { Cargable } from "../cliente/Disposicion";
import { PantallaCierre } from "../transversales/PantallaCierre";
import { useCambiarPerfil, usePerfil, type Perfil as PerfilDatos } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { textoDeError } from "./errores";
import { useAtras } from "./navegacion";

/** Pantalla `Perfil` del lienzo: nombre, correo, cambiar clave y cerrar sesión. */
export function Perfil() {
  const consulta = usePerfil();
  return (
    <Cargable consulta={consulta} texto="Un momento…">
      {(perfil) => <FormularioPerfil perfil={perfil} />}
    </Cargable>
  );
}

function FormularioPerfil({ perfil }: { perfil: PerfilDatos }) {
  const navigate = useNavigate();
  const atras = useAtras("/panel/hoy");
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const cambiar = useCambiarPerfil();
  const salir = useSalir();
  const [nombre, setNombre] = useState(perfil.nombre);
  const [error, setError] = useState<string | undefined>();

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    const limpio = nombre.trim();
    if (limpio.length < 2) {
      setError("Escriba su nombre.");
      return;
    }
    setError(undefined);
    if (limpio === perfil.nombre) {
      navigate("/panel/hoy");
      return;
    }
    cambiar.mutate({ nombre: limpio }, { onSuccess: () => navigate("/panel/hoy"), onError: (e) => setError(textoDeError(e)) });
  };

  const cerrar = () => salir.mutate(undefined, { onSettled: () => navigate("/ingreso", { replace: true }) });

  return (
    <form onSubmit={guardar} noValidate>
      <PantallaPanel
        cabecera={<BackHeader onBack={atras} />}
        pie={
          <>
            <Button type="submit" icon="check" disabled={cambiar.isPending} block>
              Guardar cambios
            </Button>
            <Button variant="outline" onClick={cerrar} disabled={salir.isPending} block>
              Cerrar sesión
            </Button>
          </>
        }
      >
        <h1 className="display-lg">Mi perfil</h1>
        {aviso ? <StatusNote>{aviso}</StatusNote> : null}
        <TextField label="Nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} error={error} />
        <OptionRow title="Mi correo" caption={perfil.correo} onClick={() => navigate("/panel/perfil/correo")} />
        <OptionRow title="Cambiar mi clave" onClick={() => navigate("/panel/perfil/clave")} />
      </PantallaPanel>
    </form>
  );
}

/** Pantalla `Perfil-correo` del lienzo: correo nuevo y clave actual para confirmar. */
export function PerfilCorreo() {
  const navigate = useNavigate();
  const cambiar = useCambiarPerfil();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<{ correo?: string; clave?: string; general?: string }>({});

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos: typeof errores = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.trim())) nuevos.correo = "Escriba un correo completo, por ejemplo nombre@correo.com.";
    if (!clave) nuevos.clave = "Escriba su clave actual.";
    setErrores(nuevos);
    if (nuevos.correo || nuevos.clave) return;
    cambiar.mutate(
      { correo: correo.trim(), clave_actual: clave },
      {
        onSuccess: () => navigate("/panel/perfil", { replace: true, state: { aviso: "Su correo cambió." } }),
        onError: (e) => {
          if (esErrorApi(e, "clave_incorrecta")) setErrores({ clave: "Esa no es su clave actual. Revise e inténtelo de nuevo." });
          else if (esErrorApi(e, "correo_en_uso")) setErrores({ correo: e.message });
          else if (esErrorApi(e, "validacion")) setErrores({ correo: e.message });
          else setErrores({ general: textoDeError(e) });
        },
      },
    );
  };

  return (
    <form onSubmit={guardar} noValidate>
      <PantallaPanel
        cabecera={<BackHeader onBack={() => navigate("/panel/perfil")} />}
        pie={
          <Button type="submit" icon="check" disabled={cambiar.isPending} block>
            Guardar correo
          </Button>
        }
      >
        <h1 className="display-lg">Cambiar mi correo</h1>
        <p className="body-lg">Para su seguridad, escriba su clave actual.</p>
        <TextField
          label="Correo nuevo"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
        />
        <PasswordField label="Clave actual" value={clave} onChange={(e) => setClave(e.target.value)} error={errores.clave} />
        {errores.general ? (
          <p role="alert" className="body sb-pn__error">
            {errores.general}
          </p>
        ) : null}
      </PantallaPanel>
    </form>
  );
}

/** Pantalla `Perfil-clave` del lienzo: clave actual y clave nueva. */
export function PerfilClave() {
  const navigate = useNavigate();
  const cambiar = useCambiarClave();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [errores, setErrores] = useState<{ actual?: string; nueva?: string; general?: string }>({});

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos: typeof errores = {};
    if (!actual) nuevos.actual = "Escriba su clave actual.";
    if (nueva.length < CLAVE_MINIMO) nuevos.nueva = `Escriba al menos ${CLAVE_MINIMO} caracteres.`;
    setErrores(nuevos);
    if (nuevos.actual || nuevos.nueva) return;
    cambiar.mutate(
      { clave_actual: actual, clave_nueva: nueva },
      {
        onSuccess: () => navigate("/panel/perfil/clave-cambiada", { replace: true }),
        onError: (e) => {
          if (esErrorApi(e, "clave_incorrecta")) setErrores({ actual: "Esa no es su clave actual. Revise e inténtelo de nuevo." });
          else if (esErrorApi(e, "validacion")) setErrores({ nueva: e.message });
          else setErrores({ general: textoDeError(e) });
        },
      },
    );
  };

  return (
    <form onSubmit={guardar} noValidate>
      <PantallaPanel
        cabecera={<BackHeader onBack={() => navigate("/panel/perfil")} />}
        pie={
          <Button type="submit" icon="check" disabled={cambiar.isPending} block>
            Cambiar mi clave
          </Button>
        }
      >
        <h1 className="display-lg">Cambiar mi clave</h1>
        <PasswordField label="Clave actual" value={actual} onChange={(e) => setActual(e.target.value)} error={errores.actual} />
        <PasswordField
          label="Clave nueva"
          autoComplete="new-password"
          helper={`Mínimo ${CLAVE_MINIMO} caracteres.`}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          error={errores.nueva}
        />
        {errores.general ? (
          <p role="alert" className="body sb-pn__error">
            {errores.general}
          </p>
        ) : null}
      </PantallaPanel>
    </form>
  );
}

/** Pantalla `Clave-cambiada` del lienzo. */
export function ClaveCambiada() {
  const consulta = usePerfil();
  return (
    <Cargable consulta={consulta} texto="Un momento…">
      {(perfil) => (
        <PantallaCierre icon="check" title="Su clave cambió" text={`Le enviamos un aviso a ${perfil.correo}. Si no fue usted, escríbale al administrador.`}>
          <Button to="/panel/perfil" block>
            Volver a mi perfil
          </Button>
        </PantallaCierre>
      )}
    </Cargable>
  );
}
