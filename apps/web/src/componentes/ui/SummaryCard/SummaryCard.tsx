import { cx } from "../../../lib/cx";
import { Icon, type IconName } from "../Icon/Icon";
import "./SummaryCard.css";

export interface SummaryCardItem {
  icon: IconName;
  text: string;
}

export interface SummaryCardProps {
  items: SummaryCardItem[];
  label?: string;
  className?: string;
}

export function SummaryCard({ items, label = "Resumen de su cita", className }: SummaryCardProps) {
  return (
    <section className={cx("sb-summary", className)} aria-label={label}>
      {items.map((it, i) => (
        <div key={i} className="sb-summary__row">
          <Icon name={it.icon} />
          <span className="body-lg">{it.text}</span>
        </div>
      ))}
    </section>
  );
}
