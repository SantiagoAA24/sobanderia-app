import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSesion } from "../api/sesion";
import { EmptyState, OptionRow, TextField } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { diaBogota } from "../lib/fechas";
import { useClientes } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { cuandoFue, inicialDe } from "./formato";
import { useRetraso } from "./retraso";

/** Pantalla `Clientes` del lienzo: buscar por nombre o celular. */
export function Clientes() {
  const navigate = useNavigate();
  const nombre = useSesion().data?.nombre ?? "";
  const [texto, setTexto] = useState("");
  const buscado = useRetraso(texto.trim());
  const consulta = useClientes(buscado);
  const hoy = diaBogota(new Date());
  const total = consulta.data?.length;
  const buscando = buscado !== "";

  return (
    <PantallaPanel
      nav="clients"
      encabezado={{
        fecha: total === undefined ? "Sus clientes" : buscando ? `${total} ${total === 1 ? "resultado" : "resultados"}` : `${total} ${total === 1 ? "cliente" : "clientes"}`,
        titulo: "Sus clientes",
        inicial: inicialDe(nombre),
      }}
    >
      <TextField label="Buscar" type="search" autoComplete="off" placeholder="Nombre o celular" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <Cargable consulta={consulta} texto="Buscando clientes…">
        {(clientes) =>
          clientes.length === 0 ? (
            <EmptyState
              title={buscando ? "No encontramos a nadie" : "Todavía no tiene clientes"}
              text={buscando ? "Revise el nombre o el celular." : "Cuando alguien agende con usted, aparecerá aquí."}
            />
          ) : (
            <ul className="sb-pn__lista">
              {clientes.map((c) => (
                <li key={c.id}>
                  <OptionRow
                    title={c.nombre}
                    caption={c.ultima_cita ? `Última cita: ${cuandoFue(c.ultima_cita, hoy)}` : "Sin citas anteriores"}
                    initial={inicialDe(c.nombre)}
                    onClick={() => navigate(`/panel/clientes/${c.id}`)}
                  />
                </li>
              ))}
            </ul>
          )
        }
      </Cargable>
    </PantallaPanel>
  );
}
