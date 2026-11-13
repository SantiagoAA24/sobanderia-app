import type { ReactNode } from "react";

import { cx } from "../../../lib/cx";
import { Icon, type IconName } from "../Icon/Icon";
import "./StatusNote.css";

export interface StatusNoteProps {
  /** Por defecto "check". El estado va siempre con palabra e icono, nunca solo color. */
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

export function StatusNote({ icon = "check", children, className }: StatusNoteProps) {
  return (
    <div className={cx("sb-status", "label", className)}>
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
}
