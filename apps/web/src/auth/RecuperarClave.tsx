import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { BackHeader, Button, PasswordField, TextField } from "../componentes/ui";
import { PantallaPanel } from "../panel/Disposicion";
import { PantallaCierre } from "../transversales/PantallaCierre";
import { useRecuperarClave, useRestablecerClave } from "./consultas";
import { CLAVE_MINIMO } from "./PrimeraClave";

/** Pantalla `Olvide-clave`: pide el correo y envía el enlace. Responde igual exista o no la cuenta. */
export function OlvideClave() {
  const navigate = useNavigate();
  const recuperar = useRecuperarClave();
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState<string | undefined>();

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!correo.trim()) {
      setError("Escriba su correo.");
      return;
    }
    setError(undefined);
    recuperar.mutate(correo.trim(), {
      onSuccess: () => navigate("/olvide-clave/enviado", { replace: true, state: { correo: correo.trim() } }),
      onError: (e) => setError(esErrorApi(e) ? e.message : "No hay conexión. Revise su internet e inténtelo de nuevo."),
    });
  };

  return (
    <form onSubmit={enviar} noValidate>
      <PantallaPanel
        cabecera={<BackHeader onBack={() => navigate("/ingreso")} />}
        pie={
          <Button type="submit" icon="check" disabled={recuperar.isPending} block>
            Enviar enlace
          </Button>
        }
      >
        <h1 className="display-lg">Recupere su clave</h1>
        <p className="body-lg">Escriba su correo y le enviaremos un enlace para crear una clave nueva.</p>
        <TextField
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={error}
        />
      </PantallaPanel>
    </form>
  );
}

/** Pantalla `Clave-enviada`. */
export function ClaveEnviada() {
  const correo = (useLocation().state as { correo?: string } | null)?.correo;
  return (
    <PantallaCierre
      icon="check"
      title="Revise su correo"
      text={
        (correo ? `Le enviamos un enlace a ${correo}. ` : "Si ese correo tiene una cuenta, le enviamos un enlace. ") +
        "Puede tardar unos minutos; si no lo ve, mire en la carpeta de spam."
      }
    >
      <Button to="/ingreso" block>
        Volver a ingresar
      </Button>
    </PantallaCierre>
  );
}

/** Ruta `/restablecer/:token`: clave nueva con el enlace del correo (de un solo uso). */
export function RestablecerClave() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const restablecer = useRestablecerClave();
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [vencido, setVencido] = useState(false);

  if (vencido) {
    return (
      <PantallaCierre icon="clock" title="Este enlace ya no sirve" text="Los enlaces para crear una clave nueva sirven una sola vez y vencen a las pocas horas. Pida uno nuevo.">
        <Button to="/olvide-clave" block>
          Pedir enlace nuevo
        </Button>
        <Link to="/ingreso" className="body-lg sb-pn__enlace">
          Volver a ingresar
        </Link>
      </PantallaCierre>
    );
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (nueva.length < CLAVE_MINIMO) {
      setError(`Escriba al menos ${CLAVE_MINIMO} caracteres.`);
      return;
    }
    setError(undefined);
    restablecer.mutate(
      { token, clave_nueva: nueva },
      {
        onSuccess: () => navigate("/ingreso", { replace: true, state: { claveNueva: true } }),
        onError: (e) => {
          if (esErrorApi(e, "enlace_vencido")) setVencido(true);
          else setError(esErrorApi(e) ? e.message : "No hay conexión. Revise su internet e inténtelo de nuevo.");
        },
      },
    );
  };

  return (
    <form onSubmit={enviar} noValidate>
      <PantallaPanel
        pie={
          <Button type="submit" icon="check" disabled={restablecer.isPending} block>
            Guardar clave
          </Button>
        }
      >
        <span className="section-title sb-pn__marca">Sobandería</span>
        <h1 className="display-lg">Cree su clave nueva</h1>
        <p className="body-lg">Elija una clave que solo usted conozca.</p>
        <PasswordField
          label="Clave nueva"
          autoComplete="new-password"
          helper={`Mínimo ${CLAVE_MINIMO} caracteres.`}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          error={error}
        />
      </PantallaPanel>
    </form>
  );
}
