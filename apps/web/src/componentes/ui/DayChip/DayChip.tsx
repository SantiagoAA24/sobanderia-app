import { cx } from "../../../lib/cx";
import "./DayChip.css";

export interface DayChipProps {
  /** Inicial del día: L, M, J… */
  day: string;
  /** Número del día del mes. */
  date: string | number;
  selected?: boolean;
  /** Etiqueta accesible completa, por ejemplo "Jueves 12". */
  label?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * El nombre accesible empieza por lo que se ve (WCAG 2.5.3): quien maneja el celular por voz dice «J 12»
 * y un lector de pantalla lee «J 12, Jueves». Sin esto, «Jueves 12» no contiene el texto visible «J 12».
 */
function nombreAccesible(day: string, date: string | number, label?: string): string | undefined {
  if (!label) return undefined;
  const sinFecha = label.replace(new RegExp(`\\s*${date}$`), "").trim();
  return sinFecha ? `${day} ${date}, ${sinFecha}` : `${day} ${date}`;
}

export function DayChip({ day, date, selected = false, label, onClick, className }: DayChipProps) {
  return (
    <button
      type="button"
      className={cx("sb-daychip", selected && "sb-daychip--selected", className)}
      aria-pressed={selected}
      aria-label={nombreAccesible(day, date, label)}
      onClick={onClick}
    >
      <span className="micro">{day}</span>{" "}
      <span className="body-lg">{date}</span>
    </button>
  );
}
