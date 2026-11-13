import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Cargable } from "../cliente/Disposicion";
import { BackHeader, Button, TextField } from "../componentes/ui";
import { textoDeError } from "../panel/errores";
import { useDatosNegocio, useGuardarNegocio, type DatosNegocio } from "./consultas";
import { PantallaAdmin } from "./Disposicion";

const TELEFONO = /^\+?[0-9][0-9 ()-]{5,28}$/;

type Errores = Partial<Record<keyof DatosNegocio | "general", string>>;

/** Pantalla `Admin-Negocio` del lienzo: nombre, dirección, teléfono y mensaje de bienvenida. */
export function Negocio() {
  const consulta = useDatosNegocio();
  return (
    <Cargable consulta={consulta} texto="Buscando los datos del negocio…">
      {(n) => <Formulario inicial={n} />}
    </Cargable>
  );
}

function Formulario({ inicial }: { inicial: DatosNegocio }) {
  const navigate = useNavigate();
  const guardar = useGuardarNegocio();
  const [datos, setDatos] = useState<DatosNegocio>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const campo = (k: keyof DatosNegocio) => ({
    value: datos[k],
    error: errores[k],
    onChange: (e: { target: { value: string } }) => setDatos({ ...datos, [k]: e.target.value }),
  });

  const enviar = () => {
    const limpios: DatosNegocio = {
      nombre: datos.nombre.trim(),
      direccion: datos.direccion.trim(),
      telefono: datos.telefono.trim(),
      mensaje_bienvenida: datos.mensaje_bienvenida.trim(),
    };
    const nuevos: Errores = {};
    if (!limpios.nombre) nuevos.nombre = "Escriba el nombre del negocio.";
    if (!limpios.direccion) nuevos.direccion = "Escriba la dirección del local.";
    if (!TELEFONO.test(limpios.telefono)) nuevos.telefono = "Escriba un teléfono válido, por ejemplo +57 300 111 2233.";
    if (!limpios.mensaje_bienvenida) nuevos.mensaje_bienvenida = "Escriba el mensaje de bienvenida.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    guardar.mutate(limpios, {
      onSuccess: () => navigate("/admin/hoy", { replace: true, state: { aviso: "Datos del negocio guardados." } }),
      onError: (e) => setErrores({ general: textoDeError(e) }),
    });
  };

  return (
    <PantallaAdmin
      cabecera={<BackHeader onBack={() => navigate("/admin/hoy")} />}
      pie={
        <Button icon="check" onClick={enviar} disabled={guardar.isPending} block>
          Guardar
        </Button>
      }
    >
      <h1 className="display-lg">Datos del negocio</h1>
      <TextField label="Nombre" type="text" autoComplete="off" {...campo("nombre")} />
      <TextField label="Dirección" type="text" autoComplete="off" {...campo("direccion")} />
      <TextField label="Teléfono" type="tel" inputMode="tel" autoComplete="off" {...campo("telefono")} />
      <TextField label="Mensaje de bienvenida" type="text" helper="Se muestra en la pantalla de inicio." {...campo("mensaje_bienvenida")} />
      {errores.general ? (
        <p role="alert" className="body sb-pn__error">
          {errores.general}
        </p>
      ) : null}
    </PantallaAdmin>
  );
}
