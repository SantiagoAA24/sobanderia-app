import { cx } from "../../../lib/cx";
import { Icon, type IconName } from "../Icon/Icon";
import "./OptionRow.css";

export interface OptionRowProps {
  /** Texto principal, por ejemplo "Carlos" o "Viernes 13 de noviembre". */
  title: string;
  /** Línea secundaria, por ejemplo "Próximo cupo: hoy, 10:30 a. m.". */
  caption?: string;
  /** Inicial dentro de un avatar a la izquierda. */
  initial?: string;
  /** Icono dentro de un círculo a la izquierda (tiene prioridad sobre `initial`). */
  icon?: IconName;
  /** chevron (por defecto) para pasar a otra pantalla; radio para elegir; none. */
  trailing?: "chevron" | "radio" | "none";
  /** Marca la opción elegida; añade aria-pressed. */
  selected?: boolean;
  /** Resalta la fila sin marcarla como elegida (por ejemplo "Primer turno disponible"). */
  highlight?: boolean;
  /** Sin disponibilidad: fondo arena y no se puede tocar. */
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function OptionRow({
  title,
  caption,
  initial,
  icon,
  trailing = "chevron",
  selected,
  highlight,
  disabled,
  onClick,
  className,
}: OptionRowProps) {
  const conGuia = Boolean(icon || initial);
  return (
    <button
      type="button"
      className={cx(
        "sb-option",
        conGuia && "sb-option--lead",
        (selected || highlight) && "sb-option--selected",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected === undefined ? undefined : selected}
    >
      {icon ? (
        <span className="sb-option__lead sb-option__lead--icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
      ) : initial ? (
        <span className="sb-option__lead sb-option__lead--avatar display-sm" aria-hidden="true">
          {initial}
        </span>
      ) : null}
      <span className="sb-option__text">
        <span className="body-lg">{title}</span>
        {caption ? <span className="caption sb-option__caption">{caption}</span> : null}
      </span>
      {trailing === "chevron" ? (
        <span className="sb-option__chevron" aria-hidden="true">
          <Icon name="chevron-right" />
        </span>
      ) : trailing === "radio" && !disabled ? (
        selected ? (
          <span className="sb-option__radio sb-option__radio--on" aria-hidden="true">
            <Icon name="check" />
          </span>
        ) : (
          <span className="sb-option__radio" aria-hidden="true" />
        )
      ) : null}
    </button>
  );
}
