import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { BackHeader, Button, TextField } from "../componentes/ui";
import { normalizarCelular } from "../lib/celular";
import { PantallaCierre } from "../transversales/PantallaCierre";
import { usePedirEnlace } from "./consultas";

export const RUTA_ENLACE_ENVIADO = "/encontrar-cita/enviado";

/** Pantalla `Encontrar-cita` del lienzo. */
export function EncontrarCita() {
  const navigate = useNavigate();
  const pedir = usePedirEnlace();
  const [celular, setCelular] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const numero = normalizarCelular(celular);
    setAviso(null);
    if (!numero) {
      setError("Escriba los 10 dígitos de su celular.");
      return;
    }
    setError(undefined);
    pedir.mutate(numero, {
      onSuccess: () => navigate(RUTA_ENLACE_ENVIADO, { replace: true }),
      onError: (e) => setAviso(esErrorApi(e) ? e.message : "No hay conexión. Revise su internet e inténtelo de nuevo."),
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="sb-pantalla">
      <div className="sb-cl__cab">
        <BackHeader onBack={() => navigate("/")} />
      </div>
      <main className="sb-cl__main">
        <h1 className="display-lg">Encuentre su cita</h1>
        <p className="body-lg">Escriba el celular con el que agendó y le enviaremos por WhatsApp el enlace a su cita.</p>
        <TextField
          label="Número de celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 000 0000"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          error={error}
        />
        {aviso ? (
          <p role="alert" className="body sb-cl__error">
            {aviso}
          </p>
        ) : null}
      </main>
      <div className="sb-cl__pie">
        <Button type="submit" icon="chat" disabled={pedir.isPending} block>
          Enviar enlace
        </Button>
      </div>
    </form>
  );
}

/** Pantalla `Enlace-enviado-cliente`: responde igual exista o no la cita. */
export function EnlaceEnviadoCliente() {
  return (
    <PantallaCierre
      icon="chat"
      title="Revise su WhatsApp"
      text="Si ese número tiene una cita, le enviamos el enlace para verla, cambiarla o cancelarla. Puede tardar un minuto."
    >
      <Button to="/" block>
        Volver al inicio
      </Button>
    </PantallaCierre>
  );
}

