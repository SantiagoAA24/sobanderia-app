import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { esHoraOcupada } from "../api/errores";
import { BackHeader, Button, TextField } from "../componentes/ui";
import { normalizarCelular } from "../lib/celular";
import { diaBogota, esDiaValido } from "../lib/fechas";
import { PANEL, useCrearCitaManual } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { ElegirDiaHora, type DiaHora } from "./ElegirDiaHora";
import { textoDeError } from "./errores";
import { useAtras } from "./navegacion";

/** Datos que otra pantalla puede dejar para no volver a escribirlos («Darle otra hora», ficha del cliente). */
export interface PrellenadoNuevaCita {
  nombre?: string;
  celular?: string;
}

/** Pantalla `Nueva-cita` del lienzo: agendar a quien llamó por teléfono. */
export function NuevaCita() {
  const navigate = useNavigate();
  const atras = useAtras("/panel/hoy");
  const cliente = useQueryClient();
  const [params] = useSearchParams();
  const previo = (useLocation().state ?? {}) as PrellenadoNuevaCita;
  const crear = useCrearCitaManual();
  const pedido = params.get("dia");
  const [nombre, setNombre] = useState(previo.nombre ?? "");
  const [celular, setCelular] = useState(previo.celular ?? "");
  const [eleccion, setEleccion] = useState<DiaHora>({ dia: esDiaValido(pedido) ? pedido : null, inicio: null });
  const [errores, setErrores] = useState<{ nombre?: string; celular?: string; general?: string }>({});

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    const numero = normalizarCelular(celular);
    const nuevos: typeof errores = {};
    if (nombre.trim().length < 2) nuevos.nombre = "Escriba el nombre del cliente.";
    if (!numero) nuevos.celular = "Escriba los 10 dígitos del celular.";
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.celular || !numero || !eleccion.inicio) return;
    crear.mutate(
      { nombre: nombre.trim(), celular: numero, inicio: eleccion.inicio },
      {
        onSuccess: () => navigate(eleccion.dia === diaBogota(new Date()) ? "/panel/hoy" : `/panel/semana?dia=${eleccion.dia}`, { replace: true }),
        onError: (e) => {
          if (esHoraOcupada(e)) {
            setErrores({ general: "Esa hora ya se ocupó. Elija otra, por favor." });
            setEleccion({ dia: eleccion.dia, inicio: null });
            void cliente.invalidateQueries({ queryKey: [PANEL, "horas"] });
          } else setErrores({ general: textoDeError(e) });
        },
      },
    );
  };

  return (
    <form onSubmit={guardar} noValidate>
      <PantallaPanel
        cabecera={<BackHeader onBack={atras} />}
        pie={
          <Button type="submit" icon="check" disabled={!eleccion.inicio || crear.isPending} block>
            Guardar cita
          </Button>
        }
      >
        <h1 className="display-lg">Nueva cita</h1>
        <TextField
          label="Nombre completo"
          placeholder="Nombre del cliente"
          autoComplete="off"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errores.nombre}
        />
        <TextField
          label="Número de celular"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="300 000 0000"
          helper="Le enviaremos la confirmación por WhatsApp."
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          error={errores.celular}
        />
        <ElegirDiaHora valor={eleccion} onChange={setEleccion} />
        {errores.general ? (
          <p role="alert" className="body sb-pn__error">
            {errores.general}
          </p>
        ) : null}
      </PantallaPanel>
    </form>
  );
}
