import { cx } from "../../../lib/cx";
import { IconButton } from "../IconButton/IconButton";
import "./AppointmentRow.css";

export interface AppointmentRowProps {
  /** Hora sin "a. m.", por ejemplo "10:30". */
  time: string;
  /** "a. m." o "p. m." */
  meridiem: string;
  name: string;
  /** Por defecto "30 min". */
  duration?: string;
  onCall?: () => void;
  className?: string;
}

export function AppointmentRow({ time, meridiem, name, duration = "30 min", onCall, className }: AppointmentRowProps) {
  return (
    <div className={cx("sb-row", className)}>
      <div className="sb-row__time">
        <span className="display-md">{time}</span>
        <span className="micro sb-muted">{meridiem}</span>
      </div>
      <div className="sb-row__main">
        <span className="body-lg">{name}</span>
        <span className="caption sb-muted">{duration}</span>
      </div>
      <IconButton icon="phone" label={`Llamar a ${name}`} onClick={onCall} />
    </div>
  );
}
