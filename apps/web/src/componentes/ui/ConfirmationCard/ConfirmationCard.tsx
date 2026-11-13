import { cx } from "../../../lib/cx";
import "./ConfirmationCard.css";

export interface ConfirmationCardProps {
  /** Por defecto "Su cita". */
  label?: string;
  time: string;
  meridiem: string;
  /** Fecha completa, por ejemplo "Viernes 13 de noviembre". */
  title: string;
  /** Por ejemplo "Con Carlos · Sesión de 30 minutos". */
  detail?: string;
  className?: string;
}

/** El momento terracota del flujo del cliente: solo una por pantalla. */
export function ConfirmationCard({ label = "Su cita", time, meridiem, title, detail, className }: ConfirmationCardProps) {
  return (
    <section className={cx("sb-confirm", className)} aria-label={label}>
      <span className="label sb-confirm__label">{label}</span>
      <div className="display-xl">
        {time} <span className="sb-confirm__meridiem">{meridiem}</span>
      </div>
      <div className="sb-confirm__text">
        <span className="title-lg">{title}</span>
        {detail ? <span className="body">{detail}</span> : null}
      </div>
    </section>
  );
}
