import { cx } from "../../../lib/cx";
import { Button } from "../Button/Button";
import "./NextAppointmentCard.css";

export interface NextAppointmentCardProps {
  time: string;
  meridiem: string;
  name: string;
  /** Por ejemplo "Sesión de 30 minutos". */
  detail?: string;
  /** Por ejemplo "En 10 min". */
  countdown?: string;
  /** Por defecto "Siguiente cita". */
  label?: string;
  onCall?: () => void;
  onChat?: () => void;
  className?: string;
}

/** El momento terracota de la agenda del sobandero: solo una por pantalla. */
export function NextAppointmentCard({
  time,
  meridiem,
  name,
  detail,
  countdown,
  label = "Siguiente cita",
  onCall,
  onChat,
  className,
}: NextAppointmentCardProps) {
  return (
    <section className={cx("sb-next", className)} aria-label={label}>
      <div className="sb-next__top">
        <span className="label sb-next__label">{label}</span>
        {countdown ? <span className="caption-strong sb-next__pill">{countdown}</span> : null}
      </div>
      <div className="sb-next__body">
        <div className="display-xl">
          {time} <span className="sb-next__meridiem">{meridiem}</span>
        </div>
        <div className="title-lg sb-next__name">{name}</div>
        {detail ? <div className="body">{detail}</div> : null}
      </div>
      <div className="sb-next__actions">
        <Button variant="onBrand" size="md" icon="phone" onClick={onCall}>
          Llamar
        </Button>
        <Button variant="onBrand" size="md" icon="chat" onClick={onChat}>
          WhatsApp
        </Button>
      </div>
    </section>
  );
}
