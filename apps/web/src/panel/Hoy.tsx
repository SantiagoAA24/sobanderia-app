import { Link, useLocation, useNavigate } from "react-router-dom";

import { useSesion } from "../api/sesion";
import { Button, EmptyState, NextAppointmentCard, StatusNote } from "../componentes/ui";
import { abrirWhatsapp, llamar } from "../lib/contacto";
import { cuentaRegresiva, diaBogota, fechaLarga, horaParaMostrar, saludo } from "../lib/fechas";
import { Cargable } from "../cliente/Disposicion";
import { useAhora } from "./ahora";
import { useCitasDia, type CitaPanel } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { FilaCita } from "./FilaCita";
import { inicialDe, minutosEntre, primerNombre } from "./formato";

/** Pantalla `Hoy` del lienzo: la siguiente cita en terracota y las del día. */
export function Hoy() {
  const navigate = useNavigate();
  const ahora = useAhora();
  const hoy = diaBogota(ahora);
  const sesion = useSesion();
  const consulta = useCitasDia(hoy);
  const nombre = sesion.data?.nombre ?? "";
  // Lo deja la pantalla que acaba de guardar algo (por ejemplo, Bloquear horas).
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;

  return (
    <PantallaPanel
      nav="today"
      encabezado={{ fecha: fechaLarga(hoy), titulo: `${saludo(ahora)}, ${primerNombre(nombre)}`, inicial: inicialDe(nombre) }}
      pie={
        <>
          <Button icon="plus" onClick={() => navigate("/panel/nueva-cita")} block>
            Nueva cita
          </Button>
          <Button variant="outline" onClick={() => navigate("/panel/bloquear")} block>
            Bloquear horas
          </Button>
        </>
      }
    >
      {aviso ? <StatusNote icon="check">{aviso}</StatusNote> : null}
      <Cargable consulta={consulta} texto="Buscando sus citas…">
        {(citas) => <CitasDeHoy citas={citas} ahora={ahora} />}
      </Cargable>
    </PantallaPanel>
  );
}

function CitasDeHoy({ citas, ahora }: { citas: CitaPanel[]; ahora: Date }) {
  const agendadas = citas.filter((c) => c.estado === "agendada");
  const atendidas = citas.filter((c) => c.estado === "atendida").length;
  const enCurso = agendadas.filter((c) => new Date(c.fin) > ahora);
  const [siguiente, ...mas] = enCurso;
  // Citas que ya terminaron y siguen sin marcar: se muestran para que no queden abiertas.
  const sinMarcar = agendadas.filter((c) => new Date(c.fin) <= ahora);

  return (
    <>
      {siguiente ? (
        <div className="sb-pn__seccion">
          <NextAppointmentCard
            time={horaParaMostrar(siguiente.inicio).hora}
            meridiem={horaParaMostrar(siguiente.inicio).meridiem}
            name={siguiente.cliente.nombre}
            detail={`Sesión de ${minutosEntre(siguiente.inicio, siguiente.fin)} minutos`}
            countdown={cuentaRegresiva(siguiente.inicio, ahora)}
            onCall={() => llamar(siguiente.cliente.celular)}
            onChat={() => abrirWhatsapp(siguiente.cliente.celular)}
          />
          <Link to={`/panel/citas/${siguiente.id}`} className="body-lg sb-pn__enlace">
            Ver la cita de {siguiente.cliente.nombre}
          </Link>
        </div>
      ) : null}

      {mas.length > 0 ? (
        <section className="sb-pn__seccion" aria-label="Más tarde hoy">
          <h2 className="section-title">Más tarde hoy</h2>
          {mas.map((c) => (
            <FilaCita key={c.id} cita={c} />
          ))}
        </section>
      ) : null}

      {sinMarcar.length > 0 ? (
        <section className="sb-pn__seccion" aria-label="Sin marcar">
          <h2 className="section-title">Sin marcar</h2>
          {sinMarcar.map((c) => (
            <FilaCita key={c.id} cita={c} />
          ))}
        </section>
      ) : null}

      {!siguiente && sinMarcar.length === 0 ? (
        <EmptyState
          title={atendidas > 0 ? "No le quedan citas hoy" : "No tiene citas hoy"}
          text={atendidas > 0 ? "Ya atendió las de hoy. Buen trabajo." : "Cuando alguien agende, la cita aparecerá aquí."}
        />
      ) : null}

      {atendidas > 0 ? <StatusNote icon="check">{atendidas === 1 ? "1 cita atendida hoy" : `${atendidas} citas atendidas hoy`}</StatusNote> : null}
    </>
  );
}
