import { useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { esErrorApi, esHoraOcupada } from "../api/errores";
import { Button, CheckboxField, StepHeader, SummaryCard, TextField } from "../componentes/ui";
import { normalizarCelular } from "../lib/celular";
import { fechaLarga, horaParaMostrar } from "../lib/fechas";
import { NoEncontrada } from "../transversales/NoEncontrada";
import { Cargable } from "./Disposicion";
import { HoraOcupada } from "./HoraOcupada";
import { useCrearCita, useSobanderos } from "./consultas";
import { borrarBorrador, guardarBorrador, inicioDe, leerBorrador, leerDia, leerHora, leerId, rutaAgendar } from "./estadoAgendar";

export const MENSAJES = {
  nombre: "Escriba su nombre completo.",
  celular: "Escriba los 10 dígitos de su celular.",
  consentimiento: "Para agendar, necesitamos que lo acepte.",
  sinConexion: "No hay conexión. Revise su internet e inténtelo de nuevo; sus datos siguen aquí.",
} as const;

interface Errores {
  nombre?: string;
  celular?: string;
  acepta?: string;
}

interface Ocupada {
  pedida: string;
  alternativas: string[];
}

/** Pantallas `Paso4-Datos`, `Paso4-Errores` y `Hora-ocupada` del lienzo. */
export function Paso4Datos() {
  const { sobanderoId } = useParams();
  const id = leerId(sobanderoId);
  const [params] = useSearchParams();
  const dia = leerDia(params);
  const hora = leerHora(params);
  const sobanderos = useSobanderos();

  return (
    <Cargable consulta={sobanderos} texto="Buscando horas libres…">
      {(lista) => {
        const sobandero = lista.find((s) => s.id === id);
        if (!id || !sobandero) return <NoEncontrada />;
        // Falta el día o la hora (enlace incompleto): se vuelve al paso que corresponde.
        if (!dia) return <Navigate to={rutaAgendar.dia(id)} replace />;
        if (!hora) return <Navigate to={rutaAgendar.hora(id, dia)} replace />;
        return <Formulario id={id} dia={dia} hora={hora} sobandero={sobandero} />;
      }}
    </Cargable>
  );
}

function Formulario({ id, dia, hora, sobandero }: { id: number; dia: string; hora: string; sobandero: { nombre: string; duracion_min: number } }) {
  const navigate = useNavigate();
  const crear = useCrearCita();
  const [borrador] = useState(leerBorrador);
  const [nombre, setNombre] = useState(borrador.nombre);
  const [celular, setCelular] = useState(borrador.celular);
  const [acepta, setAcepta] = useState(borrador.acepta);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<Ocupada | null>(null);

  const inicio = inicioDe(dia, hora);
  const cambiar = (nuevo: { nombre?: string; celular?: string; acepta?: boolean }) => {
    const siguiente = { nombre, celular, acepta, ...nuevo };
    if (nuevo.nombre !== undefined) setNombre(nuevo.nombre);
    if (nuevo.celular !== undefined) setCelular(nuevo.celular);
    if (nuevo.acepta !== undefined) setAcepta(nuevo.acepta);
    guardarBorrador(siguiente);
  };

  if (ocupada) {
    return (
      <HoraOcupada
        cabecera={<StepHeader step={3} onBack={() => navigate(rutaAgendar.hora(id, dia, hora))} />}
        sobandero={sobandero.nombre}
        dia={dia}
        {...ocupada}
        onElegir={(d, h) => {
          setOcupada(null);
          navigate(rutaAgendar.datos(id, d, h), { replace: true });
        }}
        onVerTodas={() => navigate(rutaAgendar.hora(id, dia))}
      />
    );
  }

  const confirmar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const e: Errores = {};
    const numero = normalizarCelular(celular);
    if (nombre.trim().length < 2) e.nombre = MENSAJES.nombre;
    if (!numero) e.celular = MENSAJES.celular;
    if (!acepta) e.acepta = MENSAJES.consentimiento;
    setErrores(e);
    setAviso(null);
    if (e.nombre || e.celular || e.acepta || !numero) return;

    crear.mutate(
      { sobandero_id: id, inicio, nombre: nombre.trim(), celular: numero, consentimiento: true },
      {
        onSuccess: ({ token }) => {
          borrarBorrador();
          navigate(rutaAgendar.listo(token), { replace: true });
        },
        onError: (error) => {
          if (esHoraOcupada(error)) setOcupada({ pedida: inicio, alternativas: (error.extra.alternativas as string[] | undefined) ?? [] });
          else if (esErrorApi(error)) setAviso(error.message);
          else setAviso(MENSAJES.sinConexion);
        },
      },
    );
  };

  const { hora: h12, meridiem } = horaParaMostrar(inicio);
  return (
    <form onSubmit={confirmar} noValidate className="sb-pantalla">
      <div className="sb-cl__cab">
        <StepHeader step={4} onBack={() => navigate(rutaAgendar.hora(id, dia, hora))} />
      </div>
      <main className="sb-cl__main">
        <h1 className="display-lg">Sus datos</h1>
        <SummaryCard
          items={[
            { icon: "users", text: `Con ${sobandero.nombre}` },
            { icon: "calendar-check", text: fechaLarga(dia) },
            { icon: "clock", text: `${h12} ${meridiem} · ${sobandero.duracion_min} min` },
          ]}
        />
        <TextField
          label="Nombre completo"
          value={nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
          autoComplete="name"
          error={errores.nombre}
        />
        <TextField
          label="Número de celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={celular}
          onChange={(e) => cambiar({ celular: e.target.value })}
          helper="Le enviaremos la confirmación por WhatsApp."
          error={errores.celular}
        />
        <CheckboxField
          label="Acepto el tratamiento de mis datos personales."
          linkText="Ver política"
          linkHref="/politica"
          checked={acepta}
          onChange={(e) => cambiar({ acepta: e.target.checked })}
          error={errores.acepta}
        />
        {aviso ? (
          <p role="alert" className="body sb-cl__error">
            {aviso}
          </p>
        ) : null}
      </main>
      <div className="sb-cl__pie">
        <Button type="submit" icon="check" disabled={crear.isPending} block>
          Confirmar cita
        </Button>
      </div>
    </form>
  );
}
