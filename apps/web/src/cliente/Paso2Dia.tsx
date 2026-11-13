import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { BackHeader, Button, OptionRow, StepHeader } from "../componentes/ui";
import { diaBogota, diaRelativo, fechaLarga, sumarDias } from "../lib/fechas";
import { NoEncontrada } from "../transversales/NoEncontrada";
import { Cargable, ConSobandero, PantallaCliente } from "./Disposicion";
import { useContextoPaso } from "./contexto";
import { useDias } from "./consultas";
import { leerDia, rutaAgendar } from "./estadoAgendar";

/** Días que se muestran: hoy y los 13 siguientes. Los que no traen cupos salen apagados. */
const DIAS_VISIBLES = 14;

/** Pantalla `Paso2-Dia` del lienzo. Sirve para agendar y, con otra ruta, para cambiar la cita. */
export function Paso2Dia() {
  const ctx = useContextoPaso();
  return (
    <Cargable consulta={ctx.consulta} texto="Buscando horas libres…">
      {() => {
        if (!ctx.sobandero) return <NoEncontrada />;
        if (ctx.modo === "cambiar" && ctx.cita && !ctx.cita.puede_modificar) return <Navigate to={ctx.rutaVolver} replace />;
        return <ElegirDia ctx={ctx} sobandero={{ id: ctx.sobandero.id, nombre: ctx.sobandero.nombre }} />;
      }}
    </Cargable>
  );
}

function ElegirDia({ ctx, sobandero }: { ctx: ReturnType<typeof useContextoPaso>; sobandero: { id: number; nombre: string } }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const dias = useDias(sobandero.id);
  const elegido = leerDia(params);

  return (
    <Cargable consulta={dias} texto="Buscando horas libres…">
      {({ dias: libres }) => {
        const hoy = diaBogota(new Date());
        const lista = Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(hoy, i));
        const conCupos = new Set(libres);
        const volver = () => navigate(ctx.rutaVolver);
        return (
          <PantallaCliente
            cabecera={
              ctx.modo === "agendar" ? <StepHeader step={2} onBack={volver} /> : <BackHeader onBack={volver} />
            }
            pie={
              <Button disabled={!elegido || !conCupos.has(elegido)} onClick={() => elegido && navigate(ctx.rutaHora(elegido))} block>
                Continuar
              </Button>
            }
          >
            <h1 className="display-lg">Elija el día</h1>
            <ConSobandero
              nombre={sobandero.nombre}
              onCambiar={ctx.modo === "agendar" ? () => navigate(rutaAgendar.sobandero) : undefined}
            />
            <ul className="sb-cl__lista" aria-label="Días">
              {lista.map((dia) => {
                const hay = conCupos.has(dia);
                const relativo = diaRelativo(dia, hoy);
                const caption = !hay
                  ? "Sin cupos"
                  : relativo === "hoy" || relativo === "mañana"
                    ? `${relativo.charAt(0).toUpperCase()}${relativo.slice(1)} · Hay cupos`
                    : "Hay cupos";
                return (
                  <li key={dia}>
                    <OptionRow
                      title={fechaLarga(dia)}
                      caption={caption}
                      trailing="radio"
                      selected={hay && elegido === dia}
                      disabled={!hay}
                      onClick={() => setParams({ dia }, { replace: true })}
                    />
                  </li>
                );
              })}
            </ul>
          </PantallaCliente>
        );
      }}
    </Cargable>
  );
}
