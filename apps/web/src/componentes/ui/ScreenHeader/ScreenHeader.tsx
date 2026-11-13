import { cx } from "../../../lib/cx";
import "./ScreenHeader.css";

export interface ScreenHeaderProps {
  /** Por ejemplo "Jueves 12 de noviembre". */
  date: string;
  /** Por ejemplo "Buenos días, Carlos". */
  title: string;
  /** Inicial del avatar; sin ella no se dibuja. */
  initial?: string;
  className?: string;
}

export function ScreenHeader({ date, title, initial, className }: ScreenHeaderProps) {
  return (
    <header className={cx("sb-header", className)}>
      <div className="sb-header__text">
        <span className="label sb-muted">{date}</span>
        <h1 className="display-lg">{title}</h1>
      </div>
      {initial ? (
        <div className="sb-avatar display-sm" aria-hidden="true">
          {initial}
        </div>
      ) : null}
    </header>
  );
}
