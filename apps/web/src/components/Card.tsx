import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Adds hover affordance and a pointer cursor, for cards that navigate somewhere. */
  interactive?: boolean;
  selected?: boolean;
  tone?: 'default' | 'accent' | 'warning' | 'critical';
}

const TONES: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'border-line',
  accent: 'border-accent/60',
  warning: 'border-warning/60',
  critical: 'border-critical/70',
};

export function Card({
  children,
  interactive = false,
  selected = false,
  tone = 'default',
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        'rounded-card border bg-surface-1 transition-colors',
        TONES[tone],
        selected ? 'ring-2 ring-accent/50' : '',
        interactive
          ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:border-line-strong hover:bg-surface-2'
          : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-3.5 py-2.5">
      <div className="min-w-0">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <>
      <h3 className="truncate text-sm font-semibold text-fg">{children}</h3>
      {subtitle ? <p className="mt-0.5 truncate text-xs text-fg-muted">{subtitle}</p> : null}
    </>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={['px-3.5 py-3', className].join(' ')}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-fg-subtle">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? (
        <p className="max-w-md text-xs leading-relaxed text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A labelled block of text with an optional copy affordance.
 *
 * Used for the TOTP secret, where the value has to be transcribed exactly, so the value is
 * monospaced and selectable rather than truncated.
 */
export function CopyField({
  label,
  value,
  onCopy,
  copied = false,
}: {
  label: ReactNode;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm tracking-wider break-all text-fg select-all">
          {value}
        </code>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 cursor-pointer rounded border border-line-strong px-2 py-1 text-xs text-fg-muted hover:bg-surface-3 hover:text-fg"
          >
            {copied ? '已复制' : '复制'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
