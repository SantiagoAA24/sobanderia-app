import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "../../lib/axe";
import { describe, expect, it, vi } from "vitest";

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
} from ".";

function pintar(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** Cada componente, con una instancia mínima, debe pasar axe. */
const CASOS: Array<[string, ReactElement]> = [
  ["Icon", <Icon key="i" name="clock" />],
  ["Button", <Button key="b">Agendar</Button>],
  ["Button con enlace", <Button key="bl" to="/">Ir al inicio</Button>],
  ["IconButton", <IconButton key="ib" icon="phone" label="Llamar" />],
  ["AppointmentRow", <AppointmentRow key="ar" time="10:30" meridiem="a. m." name="Luz Dary" />],
  ["NextAppointmentCard", <NextAppointmentCard key="n" time="9:30" meridiem="a. m." name="Hernán" countdown="En 10 min" />],
  ["StatusNote", <StatusNote key="s">2 citas atendidas hoy</StatusNote>],
  ["ScreenHeader", <ScreenHeader key="sh" date="Jueves 12 de noviembre" title="Buenos días, Carlos" initial="C" />],
  ["BottomNav", <BottomNav key="bn" active="today" />],
  ["StepHeader", <StepHeader key="st" step={2} />],
  ["OptionRow", <OptionRow key="o" title="Carlos" caption="Próximo cupo: hoy" initial="C" />],
  ["TimeSlot", <TimeSlot key="t" time="10:30" meridiem="a. m." />],
  ["TextField", <TextField key="tf" label="Nombre" helper="Como aparece en su cédula" />],
  ["CheckboxField", <CheckboxField key="c" label="Acepto el uso de mis datos." linkText="Ver política" />],
  ["SummaryCard", <SummaryCard key="sc" items={[{ icon: "users", text: "Con Carlos" }]} />],
  ["ConfirmationCard", <ConfirmationCard key="cc" time="10:30" meridiem="a. m." title="Viernes 13 de noviembre" />],
  ["BackHeader", <BackHeader key="bh" />],
  ["DayChip", <DayChip key="d" day="J" date={12} label="Jueves 12" />],
  ["EmptyState", <EmptyState key="e" title="No hay horas libres" text="Pruebe con otro día." />],
  ["Switch", <Switch key="sw" label="Recibe citas" />],
  ["PasswordField", <PasswordField key="p" label="Clave" />],
  ["Skeleton", <Skeleton key="sk" />],
];

describe("accesibilidad de los 21 componentes", () => {
  it.each(CASOS)("%s no tiene violaciones de axe", async (_nombre, ui) => {
    const { container } = pintar(ui);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("cubre los 21 componentes del sistema", () => {
    const nombres = new Set(CASOS.map(([n]) => n.split(" ")[0]));
    expect(nombres.size).toBe(21);
  });
});

describe("Button", () => {
  it("llama a onClick y respeta disabled", async () => {
    const alTocar = vi.fn();
    const { rerender } = pintar(<Button onClick={alTocar}>Agendar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Agendar" }));
    expect(alTocar).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <Button onClick={alTocar} disabled>
          Agendar
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Agendar" })).toBeDisabled();
  });

  it("con `to` es un enlace con aspecto de botón", () => {
    pintar(<Button to="/encontrar-cita">Pedir enlace nuevo</Button>);
    expect(screen.getByRole("link", { name: "Pedir enlace nuevo" })).toHaveAttribute("href", "/encontrar-cita");
  });

  it("usa la variante y el tamaño pedidos", () => {
    pintar(<Button variant="outline" size="md">Cancelar</Button>);
    const boton = screen.getByRole("button", { name: "Cancelar" });
    expect(boton).toHaveClass("sb-button--outline", "sb-button--md");
  });
});

describe("IconButton y AppointmentRow", () => {
  it("el botón de icono se nombra con su etiqueta", () => {
    pintar(<IconButton icon="phone" label="Llamar a Luz Dary" />);
    expect(screen.getByRole("button", { name: "Llamar a Luz Dary" })).toBeInTheDocument();
  });

  it("la fila de cita ofrece llamar al cliente", async () => {
    const alLlamar = vi.fn();
    pintar(<AppointmentRow time="10:30" meridiem="a. m." name="Luz Dary" onCall={alLlamar} />);
    expect(screen.getByText("30 min")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Llamar a Luz Dary" }));
    expect(alLlamar).toHaveBeenCalled();
  });
});

describe("NextAppointmentCard", () => {
  it("muestra cuenta regresiva y acciones", () => {
    pintar(<NextAppointmentCard time="9:30" meridiem="a. m." name="Hernán" detail="Sesión de 30 minutos" countdown="En 10 min" />);
    expect(screen.getByRole("region", { name: "Siguiente cita" })).toBeInTheDocument();
    expect(screen.getByText("En 10 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Llamar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
  });
});

describe("BottomNav", () => {
  it("marca el elemento activo con aria-current y avisa al elegir otro", async () => {
    const alElegir = vi.fn();
    pintar(<BottomNav active="week" onSelect={alElegir} />);
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Hoy" })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("button", { name: "Clientes" }));
    expect(alElegir).toHaveBeenCalledWith("clients");
  });
});

describe("StepHeader", () => {
  it("en el paso 1 muestra la marca y no «Atrás»", () => {
    pintar(<StepHeader step={1} />);
    expect(screen.getByText("Sobandería")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Paso 1 de 4" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("desde el paso 2 ofrece «Atrás»", async () => {
    const alVolver = vi.fn();
    pintar(<StepHeader step={3} onBack={alVolver} />);
    await userEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(alVolver).toHaveBeenCalled();
    expect(screen.getByText("Paso 3 de 4")).toBeInTheDocument();
  });
});

describe("OptionRow", () => {
  it("expone aria-pressed solo cuando se puede elegir", () => {
    const { rerender } = pintar(<OptionRow title="Carlos" />);
    expect(screen.getByRole("button", { name: "Carlos" })).not.toHaveAttribute("aria-pressed");
    rerender(
      <MemoryRouter>
        <OptionRow title="Carlos" trailing="radio" selected />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Carlos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("deshabilitada no se puede tocar", async () => {
    const alTocar = vi.fn();
    pintar(<OptionRow title="Viernes 13" caption="Sin cupos" disabled onClick={alTocar} />);
    const fila = screen.getByRole("button", { name: /Viernes 13/ });
    expect(fila).toBeDisabled();
    await userEvent.click(fila);
    expect(alTocar).not.toHaveBeenCalled();
  });
});

describe("DayChip: el nombre accesible contiene lo que se ve (WCAG 2.5.3)", () => {
  it.each([
    ["J", 12, "Jueves 12", "J 12, Jueves"],
    ["M", 10, "Martes 10", "M 10, Martes"],
    ["D", 1, "Domingo 1", "D 1, Domingo"],
  ])("%s %i con etiqueta «%s»", (day, date, label, esperado) => {
    pintar(<DayChip day={day} date={date} label={label} />);
    const boton = screen.getByRole("button", { name: esperado });
    const visible = (boton.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    expect(boton.getAttribute("aria-label")?.toLowerCase()).toContain(visible);
  });
});

describe("TimeSlot y DayChip", () => {
  it("reflejan si están elegidos", () => {
    pintar(
      <>
        <TimeSlot time="10:30" meridiem="a. m." selected />
        <DayChip day="J" date={12} label="Jueves 12" />
      </>,
    );
    expect(screen.getByRole("button", { name: /10:30/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "J 12, Jueves" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("campos de texto", () => {
  it("TextField relaciona etiqueta, ayuda y error con el campo", () => {
    const { rerender } = pintar(<TextField label="Celular" helper="Solo números" />);
    const campo = screen.getByLabelText("Celular");
    expect(campo).toHaveAccessibleDescription("Solo números");
    expect(campo).not.toHaveAttribute("aria-invalid");
    rerender(
      <MemoryRouter>
        <TextField label="Celular" helper="Solo números" error="Escriba los 10 números de su celular." />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Celular")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Escriba los 10 números de su celular.");
    expect(screen.getByLabelText("Celular")).toHaveAccessibleDescription("Escriba los 10 números de su celular.");
  });

  it("TextField controlado avisa los cambios", async () => {
    function Controlado() {
      const [v, setV] = useState("");
      return <TextField label="Nombre" value={v} onChange={(e) => setV(e.target.value)} />;
    }
    pintar(<Controlado />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
  });

  it("PasswordField oculta la clave y alterna con «Mostrar»", async () => {
    pintar(<PasswordField label="Clave" autoComplete="new-password" />);
    const campo = screen.getByLabelText("Clave");
    expect(campo).toHaveAttribute("type", "password");
    expect(campo).toHaveAttribute("autocomplete", "new-password");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(campo).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar" })).toHaveAttribute("aria-pressed", "true");
  });

  it("PasswordField muestra el error como alerta", () => {
    pintar(<PasswordField label="Clave" error="Use al menos 8 caracteres." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Use al menos 8 caracteres.");
    expect(screen.getByLabelText("Clave")).toHaveAttribute("aria-invalid", "true");
  });

  it("CheckboxField se marca desde su frase y muestra el error", async () => {
    pintar(<CheckboxField label="Acepto el uso de mis datos." linkText="Ver política" error="Debe aceptar para continuar." />);
    const casilla = screen.getByRole("checkbox", { name: /Acepto el uso de mis datos/ });
    expect(casilla).not.toBeChecked();
    await userEvent.click(screen.getByText(/Acepto el uso/));
    expect(casilla).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("Debe aceptar para continuar.");
  });

  it("Switch tiene rol switch y cambia de estado", async () => {
    pintar(<Switch label="Recibe citas" />);
    const interruptor = screen.getByRole("switch", { name: "Recibe citas" });
    expect(interruptor).not.toBeChecked();
    await userEvent.click(interruptor);
    expect(interruptor).toBeChecked();
  });
});

describe("tarjetas y estados", () => {
  it("ConfirmationCard y SummaryCard son regiones con nombre", () => {
    pintar(
      <>
        <ConfirmationCard time="10:30" meridiem="a. m." title="Viernes 13 de noviembre" detail="Con Carlos · Sesión de 30 minutos" />
        <SummaryCard items={[{ icon: "users", text: "Con Carlos" }, { icon: "clock", text: "10:30 a. m." }]} />
      </>,
    );
    expect(screen.getByRole("region", { name: "Su cita" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Resumen de su cita" })).toBeInTheDocument();
  });

  it("EmptyState y StatusNote muestran su texto", () => {
    pintar(
      <>
        <EmptyState title="No hay horas libres" text="Pruebe con otro día." />
        <StatusNote icon="x">Cita cancelada</StatusNote>
      </>,
    );
    expect(screen.getByRole("heading", { name: "No hay horas libres" })).toBeInTheDocument();
    expect(screen.getByText("Cita cancelada")).toBeInTheDocument();
  });

  it("ScreenHeader pone el título como h1 y esconde el avatar", () => {
    pintar(<ScreenHeader date="Jueves 12 de noviembre" title="Buenos días, Carlos" initial="C" />);
    expect(screen.getByRole("heading", { level: 1, name: "Buenos días, Carlos" })).toBeInTheDocument();
    expect(screen.getByText("C")).toHaveAttribute("aria-hidden", "true");
  });

  it("BackHeader usa «Atrás» por defecto", () => {
    pintar(<BackHeader />);
    expect(screen.getByRole("button", { name: "Atrás" })).toBeInTheDocument();
  });

  it("Skeleton va oculto a lectores de pantalla", () => {
    const { container } = pintar(<Skeleton />);
    expect(container.querySelector(".sb-skel")).toHaveAttribute("aria-hidden", "true");
  });
});
