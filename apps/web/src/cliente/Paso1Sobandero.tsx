import { useNavigate } from "react-router-dom";

import { Button, EmptyState, OptionRow, StepHeader } from "../componentes/ui";
import { diaBogota, diaRelativo, horaParaMostrar } from "../lib/fechas";
import { Cargable, PantallaCliente } from "./Disposicion";
import { rutaAgendar } from "./estadoAgendar";
import { useNegocio, useSobanderos, type SobanderoPublico } from "./consultas";

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** «hoy, 10:30 a. m.» */
function cuando(cupo: string, hoy: string): string {
  const { hora, meridiem } = horaParaMostrar(cupo);
  return `${diaRelativo(diaBogota(cupo), hoy)}, ${hora} ${meridiem}`;
}

/** Pantalla `Main` (Paso 1 · Elegir sobandero) del lienzo. */
export function Paso1Sobandero() {
  const navigate = useNavigate();
  const sobanderos = useSobanderos();
  const telefono = useNegocio().data?.telefono;

  return (
    <Cargable consulta={sobanderos} texto="Buscando horas libres…">
      {(lista: SobanderoPublico[]) => {
        const hoy = diaBogota(new Date());
        // El servidor ya calculó el próximo cupo de cada uno; «primer turno» es el más cercano de todos.
        const conCupo = lista.filter((s) => s.proximo_cupo);
        const primero = [...conCupo].sort((a, b) => a.proximo_cupo!.localeCompare(b.proximo_cupo!))[0];
        return (
          <PantallaCliente
            cabecera={<StepHeader step={1} />}
            pie={
              telefono ? (
                <>
                  <span className="caption sb-muted sb-cl__nota">¿Prefiere llamar?</span>
                  <Button href={`tel:${telefono}`} variant="outline" icon="phone" block>
                    Llamar a la sobandería
                  </Button>
                </>
              ) : undefined
            }
          >
            <h1 className="display-lg">Elija con quién</h1>
            {lista.length === 0 ? (
              <EmptyState title="Por ahora no hay sobanderos con cupos" text="Intente más tarde o llámenos." />
            ) : (
              <ul className="sb-cl__lista">
                {primero?.proximo_cupo ? (
                  <li>
                    <OptionRow
                      title="Primer turno disponible"
                      caption={`${mayuscula(cuando(primero.proximo_cupo, hoy))}, con ${primero.nombre}`}
                      icon="clock"
                      highlight
                      onClick={() => navigate(rutaAgendar.dia(primero.id, diaBogota(primero.proximo_cupo!)))}
                    />
                  </li>
                ) : null}
                {lista.map((s) => (
                  <li key={s.id}>
                    <OptionRow
                      title={s.nombre}
                      caption={s.proximo_cupo ? `Próximo cupo: ${cuando(s.proximo_cupo, hoy)}` : "Sin cupos por ahora"}
                      initial={s.nombre.charAt(0).toUpperCase()}
                      disabled={!s.proximo_cupo}
                      onClick={() => navigate(rutaAgendar.dia(s.id))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </PantallaCliente>
        );
      }}
    </Cargable>
  );
}
