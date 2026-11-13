import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../../lib/cx";
import { Icon, type IconName } from "../Icon/Icon";
import "./Button.css";

export interface ButtonProps {
  /** solid (tinta), outline (contorno) u onBrand (blanco, solo sobre la tarjeta terracota). */
  variant?: "solid" | "outline" | "onBrand";
  /** lg = 56 px; md = 52 px. */
  size?: "lg" | "md";
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
  type?: "button" | "submit";
  /** Si se indica, es un enlace (con aspecto de botón) a esa ruta. */
  to?: string;
  /** Enlace externo o `tel:` (con aspecto de botón); para rutas de la app use `to`. */
  href?: string;
  className?: string;
  /** Texto del botón: una palabra o frase corta. */
  children: ReactNode;
}

export function Button({
  variant = "solid",
  size = "lg",
  icon,
  onClick,
  disabled,
  block,
  type = "button",
  to,
  href,
  className,
  children,
}: ButtonProps) {
  const clases = cx(
    "sb-button",
    `sb-button--${size}`,
    `sb-button--${variant === "onBrand" ? "onbrand" : variant}`,
    block && "sb-button--block",
    "body-lg",
    className,
  );
  const contenido = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );
  if (href && !disabled) {
    return (
      <a href={href} className={clases}>
        {contenido}
      </a>
    );
  }
  if (to && !disabled) {
    return (
      <Link to={to} className={clases} onClick={onClick}>
        {contenido}
      </Link>
    );
  }
  return (
    <button type={type} className={clases} onClick={onClick} disabled={disabled}>
      {contenido}
    </button>
  );
}
