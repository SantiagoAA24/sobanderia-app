import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { esErrorApi, esHoraOcupada } from "../api/errores";
import { BackHeader, Button, EmptyState, StepHeader, TimeSlot } from "../componentes/ui";
import { fechaLarga, horaBogota24, horaParaMostrar } from "../lib/fechas";
import { NoEncontrada } from "../transversales/NoEncontrada";
import { Cargable, ConSobandero, PantallaCliente } from "./Disposicion";
import { HoraOcupada } from "./HoraOcupada";
import { useContextoPaso, type ContextoPaso } from "./contexto";
import { useHoras, useReprogramar } from "./consultas";
import { inicioDe, leerDia, leerHora, rutaAgendar, rutaCita } from "./estadoAgendar";

interface Ocupada {
  dia: string;
  pedida: string;
  alternativas: string[];
}

/** Pantallas `Paso3-Hora` y `Sin-horas` del lienzo. Con ruta de cita, confirma el cambio de hora. */
export function Paso3Hora() {
  const ctx = useContextoPaso();
  const [params] = useSearchParams();
  const dia = leerDia(params);
  return (
    <Cargable consulta={ctx.consulta} texto="Buscando horas libres…">
      {() => {
        if (!ctx.sobandero) return <NoEncontrada />;
        if (ctx.modo === "cambiar" && ctx.cita && !ctx.cita.puede_modificar) return <Navigate to={ctx.rutaVolver} replace />;
        // Sin un día válido en la URL no hay nada que mostrar: se vuelve al paso anterior.
        if (!dia) return <Navigate to={ctx.rutaDia()} replace />;
        return <ElegirHora ctx={ctx} sobandero={{ id: ctx.sobandero.id, nombre: ctx.sobandero.nombre }} dia={dia} />;
      }}
    </Cargable>
  );
}

function ElegirHora({ ctx, sobandero, dia }: { ctx: ContextoPaso; sobandero: { id: number; nombre: string }; dia: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const horas = useHoras(sobandero.id, dia);
  const reprogramar = useReprogramar(ctx.token ?? "");
  const [ocupada, setOcupada] = useState<Ocupada | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const elegida = leerHora(params);

  const cabecera =
    ctx.modo === "agendar" ? (
      <StepHeader step={3} onBack={() => navigate(ctx.rutaDia(dia))} />
    ) : (
      <BackHeader onBack={() => navigate(ctx.rutaDia(dia))} />
    );

  if (ocupada) {
    return (
      <HoraOcupada
        cabecera={cabecera}
        sobandero={sobandero.nombre}
        {...ocupada}
        onElegir={(d, h) => {
          setOcupada(null);
          navigate(ctx.rutaHora(d, h), { replace: true });
        }}
        onVerTodas={() => {
          setOcupada(null);
          void horas.refetch();
        }}
      />
    );
  }

  return (
    <Cargable consulta={horas} texto="Buscando horas libres…">
      {({ horas: libres, duracion_min }) => {
        if (libres.length === 0) {
          return (
            <PantallaCliente
              cabecera={cabecera}
              pie={
                <>
                  <Button icon="calendar-week" onClick={() => navigate(ctx.rutaDia())} block>
                    Elegir otro día
                  </Button>
                  {ctx.modo === "agendar" ? (
                    <Button variant="outline" icon="users" onClick={() => navigate(rutaAgendar.sobandero)} block>
                      Elegir otro sobandero
                    </Button>
                  ) : null}
                </>
              }
            >
              <h1 className="display-lg">Elija la hora</h1>
              <ConSobandero nombre={sobandero.nombre} detalle={fechaLarga(dia)} />
              <EmptyState title={`${sobandero.nombre} no tiene horas libres ese día`} text="Pruebe con otro día o con otro sobandero." />
            </PantallaCliente>
          );
        }

        const lista = libres.map((inicio) => ({ inicio, h24: horaBogota24(inicio), ...horaParaMostrar(inicio) }));
        const seleccion = lista.find((h) => h.h24 === elegida)?.h24 ?? null;
        const manana = lista.filter((h) => h.h24 < "12:00");
        const tarde = lista.filter((h) => h.h24 >= "12:00");

        const confirmar = () => {
          if (!seleccion) return;
          if (ctx.modo === "agendar") {
            navigate(rutaAgendar.datos(sobandero.id, dia, seleccion));
            return;
          }
          setAviso(null);
          reprogramar.mutate(inicioDe(dia, seleccion), {
            onSuccess: () => navigate(rutaCita.ver(ctx.token!), { replace: true }),
            onError: (error) => {
              if (esHoraOcupada(error)) {
                setOcupada({ dia, pedida: inicioDe(dia, seleccion), alternativas: (error.extra.alternativas as string[] | undefined) ?? [] });
              } else if (esErrorApi(error)) {
                setAviso(error.message);
              } else {
                setAviso("No hay conexión. Revise su internet e inténtelo de nuevo.");
              }
            },
          });
        };

        const grupo = (nombre: string, items: typeof lista) =>
          items.length === 0 ? null : (
            <section className="sb-cl__seccion" aria-label={nombre}>
              <h2 className="section-title">{nombre}</h2>
              <div className="sb-cl__horas">
                {items.map((h) => (
                  <TimeSlot
                    key={h.inicio}
                    time={h.hora}
                    meridiem={h.meridiem}
                    selected={seleccion === h.h24}
                    onClick={() => setParams({ dia, hora: h.h24 }, { replace: true })}
                  />
                ))}
              </div>
            </section>
          );

        return (
          <PantallaCliente
            cabecera={cabecera}
            pie={
              <Button disabled={!seleccion || reprogramar.isPending} onClick={confirmar} block>
                {ctx.modo === "agendar" ? "Continuar" : "Cambiar mi cita"}
              </Button>
            }
          >
            <h1 className="display-lg">Elija la hora</h1>
            <ConSobandero nombre={sobandero.nombre} detalle={fechaLarga(dia)} onCambiar={() => navigate(ctx.rutaDia(dia))} />
            {grupo("Mañana", manana)}
            {grupo("Tarde", tarde)}
            <p className="caption sb-muted">Cada cita dura {duracion_min} minutos.</p>
            {aviso ? (
              <p role="alert" className="body sb-cl__error">
                {aviso}
              </p>
            ) : null}
          </PantallaCliente>
        );
      }}
    </Cargable>
  );
}
