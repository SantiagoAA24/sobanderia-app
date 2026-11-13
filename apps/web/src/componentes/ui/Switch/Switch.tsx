import { useId, type InputHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import "./Switch.css";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "role"> {
  label: string;
  className?: string;
}

export function Switch({ label, id, className, ...resto }: SwitchProps) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <div className={cx("sb-switch", className)}>
      <label htmlFor={idCampo} className="body-lg sb-switch__label">
        {label}
      </label>
      <input {...resto} id={idCampo} type="checkbox" role="switch" className="sb-switch__input" />
    </div>
  );
}
