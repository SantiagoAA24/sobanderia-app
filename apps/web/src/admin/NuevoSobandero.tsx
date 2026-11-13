import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { CLAVE_MINIMO } from "../auth/PrimeraClave";
import { BackHeader, Button, OptionRow, PasswordField, TextField } from "../componentes/ui";
import { textoDeError } from "../panel/errores";
import { useCrearSobandero } from "./consultas";
import { PantallaAdmin } from "./Disposicion";

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Errores {
  nombre?: string;
  correo?: string;
  clave?: string;
  general?: string;
}

/**
 * Pantalla `Admin-Nuevo` del lienzo. La clave temporal la escribe el administrador, solo vive en esta
 * pantalla y no se vuelve a mostrar: al guardar, el campo se descarta junto con la pantalla.
 */
export function NuevoSobandero() {
  const navigate = useNavigate();
  const crear = useCrearSobandero();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<Errores>({});

  const enviar = () => {
    const nuevos: Errores = {};
    if (nombre.trim().length < 2) nuevos.nombre = "Escriba el nombre completo.";
    if (!CORREO.test(correo.trim())) nuevos.correo = "Escriba un correo válido, por ejemplo nombre@correo.com.";
    if (clave.length < CLAVE_MINIMO) nuevos.clave = `Escriba al menos ${CLAVE_MINIMO} caracteres.`;
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    crear.mutate(
      { nombre: nombre.trim(), correo: correo.trim(), clave_temporal: clave, duracion_min: 30 },
      {
        onSuccess: (s) => {
          setClave("");
          navigate(`/admin/sobanderos/${s.id}`, {
            replace: true,
            state: { aviso: "Sobandero creado. Entréguele la clave temporal: no se vuelve a mostrar." },
          });
        },
        onError: (e) =>
          setErrores(esErrorApi(e, "correo_en_uso") ? { correo: "Ese correo ya está en uso. Escriba otro." } : { general: textoDeError(e) }),
      },
    );
  };

  return (
    <PantallaAdmin
      cabecera={<BackHeader onBack={() => navigate("/admin/sobanderos")} />}
      pie={
        <Button icon="check" onClick={enviar} disabled={crear.isPending} block>
          Crear sobandero
        </Button>
      }
    >
      <h1 className="display-lg">Nuevo sobandero</h1>
      <TextField label="Nombre completo" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del sobandero" autoComplete="off" error={errores.nombre} />
      <TextField label="Correo" type="email" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" autoComplete="off" error={errores.correo} />
      <PasswordField label="Clave temporal" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" helper="Deberá cambiarla al ingresar por primera vez." error={errores.clave} />
      <OptionRow title="Duración de cada cita" caption="30 minutos. Puede cambiarla después en su ficha." icon="clock" trailing="none" />
      {errores.general ? (
        <p role="alert" className="body sb-pn__error">
          {errores.general}
        </p>
      ) : null}
    </PantallaAdmin>
  );
}
