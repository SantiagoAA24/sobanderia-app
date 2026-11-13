import { cx } from "../../../lib/cx";
import { Icon } from "../Icon/Icon";
import "../BackHeader/BackHeader.css";
import "./StepHeader.css";

export interface StepHeaderProps {
  /** Paso actual (1 a total). */
  step: number;
  /** Total de pasos; 4 por defecto. */
  total?: number;
  onBack?: () => void;
  /** Por defecto solo desde el paso 2; en el paso 1 se muestra la marca. */
  showBack?: boolean;
  brand?: string;
  className?: string;
}

export function StepHeader({ step, total = 4, onBack, showBack, brand = "Sobandería", className }: StepHeaderProps) {
  const conAtras = showBack ?? step > 1;
  const textoPaso = `Paso ${step} de ${total}`;
  return (
    <header className={cx("sb-stephead", className)}>
      <div className="sb-stephead__row">
        {conAtras ? (
          <button type="button" className="sb-back body-lg" onClick={onBack}>
            <Icon name="chevron-left" size="lg" />
            Atrás
          </button>
        ) : (
          <span className="section-title sb-stephead__brand">{brand}</span>
        )}
        <span className="label sb-muted">{textoPaso}</span>
      </div>
      <div
        className="sb-steps"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={textoPaso}
      >
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={cx("sb-steps__seg", i + 1 <= step && "sb-steps__seg--on")} />
        ))}
      </div>
    </header>
  );
}
