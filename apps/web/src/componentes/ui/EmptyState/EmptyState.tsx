import { cx } from "../../../lib/cx";
import "./EmptyState.css";

export interface EmptyStateProps {
  title: string;
  text?: string;
  className?: string;
}

export function EmptyState({ title, text, className }: EmptyStateProps) {
  return (
    <section className={cx("sb-empty", className)} aria-label={title}>
      <h2 className="title-lg">{title}</h2>
      {text ? <p className="body sb-muted">{text}</p> : null}
    </section>
  );
}
