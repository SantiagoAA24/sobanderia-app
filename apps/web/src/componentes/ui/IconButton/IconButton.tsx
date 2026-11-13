import { cx } from "../../../lib/cx";
import { Icon, type IconName } from "../Icon/Icon";
import "./IconButton.css";

export interface IconButtonProps {
  icon: IconName;
  /** Obligatorio: el botón no tiene texto visible. */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function IconButton({ icon, label, onClick, disabled, className }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx("sb-icon-button", className)}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
