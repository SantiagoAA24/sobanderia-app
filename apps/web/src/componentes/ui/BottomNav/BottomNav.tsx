import { cx } from "../../../lib/cx";
import { Icon, type IconName } from "../Icon/Icon";
import "./BottomNav.css";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: IconName;
}

export const NAV_SOBANDERO: BottomNavItem[] = [
  { id: "today", label: "Hoy", icon: "calendar-check" },
  { id: "week", label: "Semana", icon: "calendar-week" },
  { id: "clients", label: "Clientes", icon: "users" },
  { id: "schedule", label: "Mi horario", icon: "clock" },
];

export interface BottomNavProps {
  /** Por defecto: Hoy, Semana, Clientes y Mi horario. */
  items?: BottomNavItem[];
  /** id del elemento activo. */
  active: string;
  onSelect?: (id: string) => void;
  /** Nombre del punto de referencia; cambie si hay más de una barra en la página. */
  label?: string;
  className?: string;
}

export function BottomNav({ items = NAV_SOBANDERO, active, onSelect, label = "Navegación principal", className }: BottomNavProps) {
  return (
    <nav className={cx("sb-nav", className)} aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="sb-nav__item micro"
          aria-current={item.id === active ? "page" : undefined}
          onClick={() => onSelect?.(item.id)}
        >
          <Icon name={item.icon} size="lg" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
