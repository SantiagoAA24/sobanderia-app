import { useId, useState, type InputHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import "../TextField/TextField.css";
import "./PasswordField.css";

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  label: string;
  helper?: string;
  error?: string;
  /** "current-password" (por defecto) o "new-password". */
  autoComplete?: "current-password" | "new-password";
  className?: string;
}

export function PasswordField({
  label,
  helper,
  error,
  id,
  className,
  autoComplete = "current-password",
  ...resto
}: PasswordFieldProps) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idNota = `${idCampo}-nota`;
  const [visible, setVisible] = useState(false);
  return (
    <div className={cx("sb-field", className)}>
      <label className="label" htmlFor={idCampo}>
        {label}
      </label>
      <div className="sb-pass">
        <input
          {...resto}
          id={idCampo}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className={cx("sb-field__input", "body-lg", "sb-pass__input", error && "sb-field__input--error")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? idNota : undefined}
        />
        <button type="button" className="sb-pass__toggle label" aria-pressed={visible} onClick={() => setVisible(!visible)}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error ? (
        <span id={idNota} className="caption sb-field__error" role="alert">
          {error}
        </span>
      ) : helper ? (
        <span id={idNota} className="caption sb-muted">
          {helper}
        </span>
      ) : null}
    </div>
  );
}
