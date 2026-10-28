"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useId, useState } from "react";

export function TransferAvailabilityAction({
  className,
  containerClassName = "pw-transfer-action",
  href,
  helpText,
  icon,
  label
}: {
  className: string;
  containerClassName?: string;
  href?: string;
  helpText: string;
  icon?: ReactNode;
  label: string;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const helpId = useId();

  if (href) {
    return (
      <Link className={className} href={href}>
        {icon}
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <span className={containerClassName}>
      <button
        className={className}
        type="button"
        aria-disabled="true"
        aria-describedby={helpId}
        onClick={() => setShowHelp((open) => !open)}
      >
        {icon}
        <span>{label}</span>
      </button>
      <span className={`pw-transfer-action-tooltip${showHelp ? " is-open" : ""}`} id={helpId} role="tooltip">
        {helpText}
      </span>
    </span>
  );
}
