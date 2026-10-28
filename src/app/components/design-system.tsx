import type { ReactNode } from "react";
import Link from "next/link";

/** Shared title block for route-level screens. */
export function PageHeader({
  id,
  eyebrow,
  title,
  description,
  actions
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="pw-page-header">
      <div className="pw-page-heading-copy">
        {eyebrow ? <p className="pw-page-eyebrow">{eyebrow}</p> : null}
        <h1 id={id}>{title}</h1>
        {description ? <p className="pw-detail-lede">{description}</p> : null}
      </div>
      {actions ? <div className="pw-page-actions">{actions}</div> : null}
    </header>
  );
}

/** A consistent heading row for sections with an optional route or action link. */
export function SectionHeader({
  id,
  title,
  action
}: {
  id?: string;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pw-section-title-row">
      <h2 id={id}>{title}</h2>
      {action ? <div className="pw-section-title-action">{action}</div> : null}
    </div>
  );
}

/** Data-first list row with a full-width, touch-sized link target. */
export function DataRow({
  href,
  title,
  detail,
  value,
  valueClassName
}: {
  href: string;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <li className="pw-data-row">
      <Link href={href}>
        <span className="pw-data-row-copy">
          <span className="pw-item-title">{title}</span>
          {detail ? <span className="pw-item-sub">{detail}</span> : null}
        </span>
        {value !== undefined ? (
          <span className={valueClassName ?? "pw-item-amount"}>{value}</span>
        ) : null}
      </Link>
    </li>
  );
}
