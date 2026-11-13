import { cx } from "../../../lib/cx";
import { Icon } from "../Icon/Icon";
import "./BackHeader.css";

export interface BackHeaderProps {
  /** Texto del botón; "Atrás" por defecto. */
  label?: string;
  onBack?: () => void;
  className?: string;
}

export function BackHeader({ label = "Atrás", onBack, className }: BackHeaderProps) {
  return (
    <header className={cx("sb-backhead", className)}>
      <button type="button" className="sb-back body-lg" onClick={onBack}>
        <Icon name="chevron-left" size="lg" />
        {label}
      </button>
    </header>
  );
}
