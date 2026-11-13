import { useId, type InputHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import "./TextField.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Etiqueta visible sobre el campo; obligatoria. */
  label: string;
  /** Texto de ayuda bajo el campo. */
  helper?: string;
  /** Mensaje de error: pinta el borde en brand-deep y reemplaza la ayuda. */
  error?: string;
  className?: string;
}

export function TextField({ label, helper, error, id, className, type = "text", ...resto }: TextFieldProps) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idNota = `${idCampo}-nota`;
  return (
    <div className={cx("sb-field", className)}>
      <label className="label" htmlFor={idCampo}>
        {label}
      </label>
      <input
        {...resto}
        id={idCampo}
        type={type}
        className={cx("sb-field__input", "body-lg", error && "sb-field__input--error")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || helper ? idNota : undefined}
      />
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
