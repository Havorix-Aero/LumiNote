import type { ReactNode } from 'react';

const TONES: Record<'accent' | 'ok' | 'info' | 'warning' | 'critical', string> = {
  accent: 'border-accent/40 bg-accent-soft text-accent-ink',
  ok: 'border-ok/40 bg-ok-soft text-ok',
  info: 'border-info/40 bg-info-soft text-info',
  warning: 'border-warning/50 bg-warning-soft text-warning',
  critical: 'border-critical/50 bg-critical-soft text-critical',
};

export interface NoticeProps {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}

/**
 * Inline status message.
 *
 * The `notice` class is part of the end-to-end contract — the suite waits on notices to confirm
 * that two-factor enrolment and security-question changes were persisted.
 */
export function Notice({ tone = 'accent', children, className = '' }: NoticeProps) {
  return (
    <p
      role="status"
      className={[
        'notice rounded-lg border px-3 py-2 text-sm leading-relaxed',
        TONES[tone],
        className,
      ].join(' ')}
    >
      {children}
    </p>
  );
}

/** Heading block shared by every full-page surface. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section wrapper used by the settings screen. */
export function Section({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
