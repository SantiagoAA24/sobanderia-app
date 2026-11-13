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

export function DayChip({ day, date, selected = false, label, onClick, className }: DayChipProps) {
  return (
    <button
      type="button"
      className={cx("sb-daychip", selected && "sb-daychip--selected", className)}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
    >
      <span className="micro">{day}</span>
      <span className="body-lg">{date}</span>
    </button>
  );
}
