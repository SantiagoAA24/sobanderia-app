import { useId, type InputHTMLAttributes } from "react";

import { cx } from "../../../lib/cx";
import "../TextField/TextField.css";
import "./CheckboxField.css";

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  label: string;
  /** Texto subrayado al final, por ejemplo "Ver política". */
  linkText?: string;
  /** Si se indica, `linkText` es un enlace que se abre en otra pestaña (el formulario no se pierde). */
  linkHref?: string;
  error?: string;
  className?: string;
}

export function CheckboxField({ label, linkText, linkHref, error, id, className, ...resto }: CheckboxFieldProps) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idError = `${idCampo}-error`;
  return (
    <div className={cx("sb-check", className)}>
      <input
        {...resto}
        id={idCampo}
        type="checkbox"
        className="sb-check__box"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
      />
      <label htmlFor={idCampo} className="caption sb-check__label">
        <span>
          {label}
          {linkText ? (
            <>
              {" "}
              {linkHref ? (
                <a className="sb-check__link" href={linkHref} target="_blank" rel="noopener noreferrer">
                  {linkText}
                </a>
              ) : (
                <span className="sb-check__link">{linkText}</span>
              )}
            </>
          ) : null}
        </span>
      </label>
      {error ? (
        <span id={idError} className="caption sb-field__error sb-check__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
