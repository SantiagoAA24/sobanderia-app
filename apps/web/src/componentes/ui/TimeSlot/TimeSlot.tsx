import { cx } from "../../../lib/cx";
import "./TimeSlot.css";

export interface TimeSlotProps {
  /** Hora sin "a. m.", por ejemplo "10:30". */
  time: string;
  /** "a. m." o "p. m." */
  meridiem: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TimeSlot({ time, meridiem, selected = false, onClick, className }: TimeSlotProps) {
  return (
    <button
      type="button"
      className={cx("sb-slot", selected && "sb-slot--selected", className)}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="body-lg">{time}</span>
      <span className="micro sb-slot__meridiem">{meridiem}</span>
    </button>
  );
}
