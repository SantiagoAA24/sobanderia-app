import { cx } from "../../../lib/cx";
import "./Icon.css";

export type IconName =
  | "phone"
  | "chat"
  | "plus"
  | "check"
  | "x"
  | "calendar-check"
  | "calendar-week"
  | "users"
  | "clock"
  | "chevron-right"
  | "chevron-left";

/** md = 22 px (botones), lg = 24 px (barra inferior), xl = 36 px (pantallas de cierre). */
export type IconSize = "md" | "lg" | "xl";

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
}

type Forma = { tipo: "path"; d: string } | { tipo: "rect"; x: number; y: number; w: number; h: number; r: number } | { tipo: "circle"; cx: number; cy: number; r: number };

const p = (d: string): Forma => ({ tipo: "path", d });

const FORMAS: Record<IconName, Forma[]> = {
  phone: [p("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z")],
  chat: [p("M4 20l1.3-4.2A8 8 0 1 1 8.2 18.7L4 20z")],
  plus: [p("M12 5v14M5 12h14")],
  check: [p("M5 12.5l4.5 4.5L19 7.5")],
  x: [p("M6 6l12 12M18 6L6 18")],
  "calendar-check": [
    { tipo: "rect", x: 4, y: 5, w: 16, h: 15, r: 2 },
    p("M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"),
  ],
  "calendar-week": [
    { tipo: "rect", x: 4, y: 5, w: 16, h: 15, r: 2 },
    p("M8 3v4M16 3v4M4 10h16M10 10v10"),
  ],
  users: [
    { tipo: "circle", cx: 9, cy: 8, r: 3.2 },
    p("M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M16 5a3 3 0 0 1 0 6M18 14.8c1.8.7 3 2.4 3 5.2"),
  ],
  clock: [{ tipo: "circle", cx: 12, cy: 12, r: 8.5 }, p("M12 7.5V12l3 2")],
  "chevron-right": [p("M9 6l6 6-6 6")],
  "chevron-left": [p("M15 6l-6 6 6 6")],
};

/** Icono de trazo; siempre acompaña a una palabra, por eso va oculto a lectores de pantalla. */
export function Icon({ name, size = "md", className }: IconProps) {
  return (
    <svg
      className={cx("sb-icon", `sb-icon--${size}`, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {FORMAS[name].map((f, i) =>
        f.tipo === "path" ? (
          <path key={i} d={f.d} />
        ) : f.tipo === "rect" ? (
          <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} />
        ) : (
          <circle key={i} cx={f.cx} cy={f.cy} r={f.r} />
        ),
      )}
    </svg>
  );
}
