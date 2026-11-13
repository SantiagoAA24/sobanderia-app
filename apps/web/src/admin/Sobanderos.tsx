import { useLocation, useNavigate } from "react-router-dom";

import { useSesion } from "../api/sesion";
import { Cargable } from "../cliente/Disposicion";
import { Button, EmptyState, OptionRow, StatusNote } from "../componentes/ui";
import { inicialDe } from "../panel/formato";
import { useSobanderos, type SobanderoAdmin } from "./consultas";
import { PantallaAdmin } from "./Disposicion";
import { textoDias } from "./formato";

/** Pantalla `Admin-Sobanderos` del lienzo: la lista con días y duración de cada uno. */
export function Sobanderos() {
  const navigate = useNavigate();
  const nombre = useSesion().data?.nombre ?? "";
  const consulta = useSobanderos();
  const n = consulta.data?.length;
  // Lo deja la ficha tras guardar.
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  return (
    <PantallaAdmin
      nav="sobs"
      encabezado={{ fecha: n === undefined ? "Sobanderos" : n === 1 ? "1 sobandero" : `${n} sobanderos`, titulo: "Sobanderos", inicial: inicialDe(nombre) }}
      pie={
        <Button icon="plus" onClick={() => navigate("/admin/sobanderos/nuevo")} block>
          Agregar sobandero
        </Button>
      }
    >
      {aviso ? <StatusNote icon="check">{aviso}</StatusNote> : null}
      <Cargable consulta={consulta} texto="Buscando a los sobanderos…">
        {(lista) =>
          lista.length === 0 ? (
            <EmptyState title="Todavía no hay sobanderos" text="Agregue al primero para que los clientes puedan agendar." />
          ) : (
            <ul className="sb-pn__lista">
              {lista.map((s) => (
                <li key={s.id}>
                  <OptionRow title={s.nombre} caption={descripcion(s)} initial={inicialDe(s.nombre)} onClick={() => navigate(`/admin/sobanderos/${s.id}`)} />
                </li>
              ))}
            </ul>
          )
        }
      </Cargable>
    </PantallaAdmin>
  );
}

/** «Lun a sáb · 30 min», con «En baja» mientras termina las citas que le quedan. */
function descripcion(s: SobanderoAdmin): string {
  const base = `${textoDias(s.dias)} · ${s.duracion_min} min`;
  return s.baja_en ? `${base} · En baja` : base;
}
