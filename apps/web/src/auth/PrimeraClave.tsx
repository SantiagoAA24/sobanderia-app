import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { useSesion } from "../api/sesion";
import { Button, PasswordField } from "../componentes/ui";
import { PantallaPanel } from "../panel/Disposicion";
import { leerClaveTemporal } from "./claveTemporal";
import { inicioDe } from "./destino";
import { useCambiarClave } from "./consultas";

export const CLAVE_MINIMO = 8;

/** Pantallas `Cambiar-clave` y `Cambiar-clave-error`: reemplaza la clave temporal del primer ingreso. */
export function PrimeraClave() {
  const navigate = useNavigate();
  const sesion = useSesion();
  const cambiar = useCambiarClave();
  // Si se recargó la página, la clave temporal ya no está en memoria y hay que pedirla.
  const [temporalGuardada] = useState(() => leerClaveTemporal());
  const [temporal, setTemporal] = useState("");
  const [nueva, setNueva] = useState("");
  const [errores, setErrores] = useState<{ temporal?: string; nueva?: string; general?: string }>({});

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const actual = temporalGuardada ?? temporal;
    const nuevos: typeof errores = {};
    if (!actual) nuevos.temporal = "Escriba la clave temporal que le dieron.";
    if (nueva.length < CLAVE_MINIMO) nuevos.nueva = `Escriba al menos ${CLAVE_MINIMO} caracteres.`;
    setErrores(nuevos);
    if (nuevos.temporal || nuevos.nueva) return;
    cambiar.mutate(
      { clave_actual: actual, clave_nueva: nueva },
      {
        onSuccess: () => navigate(sesion.data ? inicioDe(sesion.data) : "/panel/hoy", { replace: true }),
        onError: (e) => {
          if (esErrorApi(e, "clave_incorrecta")) setErrores({ temporal: "Esa no es la clave temporal. Revise e inténtelo de nuevo." });
          else if (esErrorApi(e, "validacion")) setErrores({ nueva: e.message });
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
          <Button type="submit" icon="check" disabled={cambiar.isPending} block>
            Guardar y entrar
          </Button>
        }
      >
        <span className="section-title sb-pn__marca">Sobandería</span>
        <h1 className="display-lg">Cree su clave nueva</h1>
        <p className="body-lg">Es su primer ingreso. Elija una clave que solo usted conozca.</p>
        {temporalGuardada === null ? (
          <PasswordField label="Clave temporal" value={temporal} onChange={(e) => setTemporal(e.target.value)} error={errores.temporal} />
        ) : null}
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
