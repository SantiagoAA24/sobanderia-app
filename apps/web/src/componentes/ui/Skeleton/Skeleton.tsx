import type { CSSProperties } from "react";

import { cx } from "../../../lib/cx";
import "./Skeleton.css";

export interface SkeletonProps {
  /** Medida CSS; usar variables de tokens, por ejemplo "var(--fila-min)". */
  width?: string;
  height?: string;
  className?: string;
}

/** Bloque de carga estático (sin animación). Siempre va junto a un texto visible. */
export function Skeleton({ width, height, className }: SkeletonProps) {
  const estilo: CSSProperties = { width, height };
  return <div className={cx("sb-skel", className)} aria-hidden="true" style={estilo} />;
}
