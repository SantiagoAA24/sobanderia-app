import { useState, type ReactNode } from "react";

import {
  AppointmentRow,
  BackHeader,
  BottomNav,
  Button,
  CheckboxField,
  ConfirmationCard,
  DayChip,
  EmptyState,
  Icon,
  IconButton,
  NextAppointmentCard,
  OptionRow,
  PasswordField,
  ScreenHeader,
  Skeleton,
  StatusNote,
  StepHeader,
  SummaryCard,
  Switch,
  TextField,
  TimeSlot,
  type BottomNavItem,
  type IconName,
} from "../componentes/ui";
import "./Catalogo.css";

const ICONOS: IconName[] = [
  "phone",
  "chat",
  "plus",
  "check",
  "x",
  "calendar-check",
  "calendar-week",
  "users",
  "clock",
  "chevron-right",
  "chevron-left",
];

const NAV_ADMIN: BottomNavItem[] = [
  { id: "today", label: "Hoy", icon: "calendar-check" },
  { id: "sobanderos", label: "Sobanderos", icon: "users" },
  { id: "agenda", label: "Agenda", icon: "calendar-week" },
];

const DIAS = [
  { day: "L", date: 9, label: "Lunes 9" },
  { day: "M", date: 10, label: "Martes 10" },
  { day: "M", date: 11, label: "Miércoles 11" },
  { day: "J", date: 12, label: "Jueves 12" },
  { day: "V", date: 13, label: "Viernes 13" },
  { day: "S", date: 14, label: "Sábado 14" },
  { day: "D", date: 15, label: "Domingo 15" },
];

const HORAS = [
  ["9:00", "a. m."],
  ["9:30", "a. m."],
  ["10:00", "a. m."],
  ["10:30", "a. m."],
  ["2:00", "p. m."],
  ["2:30", "p. m."],
] as const;

function Seccion({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <section className="sb-catalogo__seccion" aria-labelledby={`cat-${nombre}`}>
      <h2 id={`cat-${nombre}`} className="section-title">
        {nombre}
      </h2>
      <div className="sb-catalogo__muestra">{children}</div>
    </section>
  );
}

function Variante({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="sb-catalogo__variante">
      <span className="micro sb-muted">{nombre}</span>
      {children}
    </div>
  );
}

/** Ruta `/ui`: todos los componentes del sistema de diseño con sus variantes y estados. */
export default function Catalogo() {
  const [navSobandero, setNavSobandero] = useState("today");
  const [navAdmin, setNavAdmin] = useState("sobanderos");
  const [dia, setDia] = useState(12);
  const [hora, setHora] = useState("10:30");
  const [sobandero, setSobandero] = useState("Carlos");
  const [nombre, setNombre] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [recibe, setRecibe] = useState(true);

  return (
    <div className="sb-pantalla">
      <main className="sb-catalogo">
        <header>
          <p className="label sb-muted">Sistema de diseño</p>
          <h1 className="display-lg">Componentes</h1>
          <p className="body sb-muted">Los 21 componentes de la app, con sus variantes y estados.</p>
        </header>

        <Seccion nombre="Icon">
          <Variante nombre="Todos los iconos (md)">
            <div className="sb-catalogo__fila">
              {ICONOS.map((n) => (
                <span key={n} className="sb-catalogo__icono">
                  <Icon name={n} />
                  <span className="micro sb-muted">{n}</span>
                </span>
              ))}
            </div>
          </Variante>
          <Variante nombre="Tamaños: md, lg, xl">
            <div className="sb-catalogo__fila">
              <Icon name="clock" size="md" />
              <Icon name="clock" size="lg" />
              <Icon name="clock" size="xl" />
            </div>
          </Variante>
        </Seccion>

        <Seccion nombre="Button">
          <Variante nombre="solid · lg">
            <Button block>Agendar cita</Button>
          </Variante>
          <Variante nombre="solid · con icono">
            <Button icon="plus" block>
              Nueva cita
            </Button>
          </Variante>
          <Variante nombre="outline · lg">
            <Button variant="outline" block>
              Cambiar día u hora
            </Button>
          </Variante>
          <Variante nombre="solid y outline · md">
            <div className="sb-catalogo__fila">
              <Button size="md">Guardar</Button>
              <Button size="md" variant="outline">
                Cancelar
              </Button>
            </div>
          </Variante>
          <Variante nombre="onBrand · solo sobre terracota">
            <div className="sb-catalogo__terracota">
              <Button variant="onBrand" size="md" icon="phone" block>
                Llamar
              </Button>
            </div>
          </Variante>
          <Variante nombre="deshabilitado">
            <Button disabled block>
              Continuar
            </Button>
          </Variante>
          <Variante nombre="enlace (con `to`)">
            <Button to="/" variant="outline" block>
              Ir al inicio
            </Button>
          </Variante>
        </Seccion>

        <Seccion nombre="IconButton">
          <div className="sb-catalogo__fila">
            <IconButton icon="phone" label="Llamar" />
            <IconButton icon="chat" label="Escribir por WhatsApp" />
            <IconButton icon="plus" label="Nueva cita" />
            <IconButton icon="x" label="Cerrar" disabled />
          </div>
        </Seccion>

        <Seccion nombre="AppointmentRow">
          <AppointmentRow time="10:30" meridiem="a. m." name="Hernán Castaño" />
          <AppointmentRow time="2:00" meridiem="p. m." name="Luz Dary Pineda" duration="45 min" />
        </Seccion>

        <Seccion nombre="NextAppointmentCard">
          <NextAppointmentCard
            time="9:30"
            meridiem="a. m."
            name="Luz Dary Pineda"
            detail="Sesión de 30 minutos"
            countdown="En 10 min"
          />
        </Seccion>

        <Seccion nombre="StatusNote">
          <StatusNote>2 citas atendidas hoy</StatusNote>
          <StatusNote icon="x">1 cita cancelada</StatusNote>
        </Seccion>

        <Seccion nombre="ScreenHeader">
          <Variante nombre="con avatar">
            <ScreenHeader date="Jueves 12 de noviembre" title="Buenos días, Carlos" initial="C" />
          </Variante>
          <Variante nombre="sin avatar">
            <ScreenHeader date="Jueves 12 de noviembre" title="Semana" />
          </Variante>
        </Seccion>

        <Seccion nombre="BottomNav">
          <Variante nombre="sobandero (interactivo)">
            <BottomNav active={navSobandero} onSelect={setNavSobandero} label="Navegación del sobandero" />
          </Variante>
          <Variante nombre="administrador (tres elementos)">
            <BottomNav items={NAV_ADMIN} active={navAdmin} onSelect={setNavAdmin} label="Navegación del administrador" />
          </Variante>
        </Seccion>

        <Seccion nombre="StepHeader">
          <Variante nombre="paso 1: marca, sin «Atrás»">
            <StepHeader step={1} />
          </Variante>
          <Variante nombre="paso 3: con «Atrás»">
            <StepHeader step={3} />
          </Variante>
        </Seccion>

        <Seccion nombre="OptionRow">
          <Variante nombre="avatar · radio (elegible)">
            {["Carlos", "Marta"].map((n) => (
              <OptionRow
                key={n}
                title={n}
                caption="Próximo cupo: hoy, 10:30 a. m."
                initial={n.slice(0, 1)}
                trailing="radio"
                selected={sobandero === n}
                onClick={() => setSobandero(n)}
              />
            ))}
          </Variante>
          <Variante nombre="icono · resaltada">
            <OptionRow title="Primer turno disponible" caption="El cupo más cercano" icon="clock" highlight />
          </Variante>
          <Variante nombre="chevron (avanzar)">
            <OptionRow title="Viernes 13 de noviembre" />
          </Variante>
          <Variante nombre="deshabilitada (sin cupos)">
            <OptionRow title="Sábado 14 de noviembre" caption="Sin cupos" disabled />
          </Variante>
        </Seccion>

        <Seccion nombre="TimeSlot">
          <div className="sb-catalogo__rejilla">
            {HORAS.map(([h, m]) => (
              <TimeSlot key={`${h}${m}`} time={h} meridiem={m} selected={hora === h && m === "a. m."} onClick={() => setHora(h)} />
            ))}
          </div>
        </Seccion>

        <Seccion nombre="TextField">
          <TextField
            label="Nombre"
            placeholder="Nombre y apellido"
            autoComplete="name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <TextField label="Celular" helper="Le avisaremos por WhatsApp." inputMode="tel" autoComplete="tel" defaultValue="300 123" />
          <TextField label="Celular con error" inputMode="tel" defaultValue="300 12" error="Escriba los 10 números de su celular." />
        </Seccion>

        <Seccion nombre="CheckboxField">
          <CheckboxField
            label="Acepto el uso de mis datos para agendar."
            linkText="Ver política"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
          />
          <CheckboxField label="Acepto el uso de mis datos." linkText="Ver política" error="Debe aceptar para continuar." />
        </Seccion>

        <Seccion nombre="SummaryCard">
          <SummaryCard
            items={[
              { icon: "users", text: "Con Carlos" },
              { icon: "calendar-check", text: "Viernes 13 de noviembre" },
              { icon: "clock", text: "10:30 a. m. · 30 min" },
            ]}
          />
        </Seccion>

        <Seccion nombre="ConfirmationCard">
          <ConfirmationCard time="10:30" meridiem="a. m." title="Viernes 13 de noviembre" detail="Con Carlos · Sesión de 30 minutos" />
        </Seccion>

        <Seccion nombre="BackHeader">
          <BackHeader />
          <BackHeader label="Volver a Hoy" />
        </Seccion>

        <Seccion nombre="DayChip">
          <div className="sb-catalogo__semana">
            {DIAS.map((d) => (
              <DayChip key={d.date} {...d} selected={dia === d.date} onClick={() => setDia(d.date)} />
            ))}
          </div>
        </Seccion>

        <Seccion nombre="EmptyState">
          <EmptyState title="No hay horas libres" text="Pruebe con otro día o con otro sobandero." />
        </Seccion>

        <Seccion nombre="Switch">
          <Switch label="Recibe citas" checked={recibe} onChange={(e) => setRecibe(e.target.checked)} />
          <Switch label="Atiende los sábados" defaultChecked={false} />
        </Seccion>

        <Seccion nombre="PasswordField">
          <PasswordField label="Clave" helper="Al menos 8 caracteres." />
          <PasswordField label="Clave nueva" autoComplete="new-password" defaultValue="corta" error="Use al menos 8 caracteres." />
        </Seccion>

        <Seccion nombre="Skeleton">
          <p role="status" className="body-lg sb-muted">
            Buscando horas libres…
          </p>
          <Skeleton />
          <div className="sb-catalogo__rejilla">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        </Seccion>
      </main>
    </div>
  );
}
