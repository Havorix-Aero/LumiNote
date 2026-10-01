import type { ReactNode } from 'react';

/** Shared across badges, toasts and status text so one vocabulary covers the whole app. */
export type Tone = 'neutral' | 'accent' | 'ok' | 'info' | 'caution' | 'warning' | 'critical';

const SOFT: Record<Tone, string> = {
  neutral: 'border-line bg-surface-3 text-fg-muted',
  accent: 'border-accent/40 bg-accent-soft text-accent-ink',
  ok: 'border-ok/40 bg-ok-soft text-ok',
  info: 'border-info/40 bg-info-soft text-info',
  caution: 'border-caution/50 bg-caution-soft text-caution',
  warning: 'border-warning/50 bg-warning-soft text-warning',
  critical: 'border-critical/50 bg-critical-soft text-critical',
};

/*
 * Solid badges always take their foreground from `text-fg-inverted`: light themes get white on a
 * dark fill, dark themes get near-black on a bright fill. A hard-coded `text-white` would drop to
 * roughly 2.8:1 on the dark-theme reds, which is exactly where a warning badge must not fail.
 */
const SOLID: Record<Tone, string> = {
  neutral: 'border-transparent bg-fg-muted text-surface-0',
  accent: 'border-transparent bg-accent text-accent-fg',
  ok: 'border-transparent bg-ok text-fg-inverted',
  info: 'border-transparent bg-info text-fg-inverted',
  caution: 'border-transparent bg-caution text-fg-inverted',
  warning: 'border-transparent bg-warning text-fg-inverted',
  critical: 'border-transparent bg-critical text-fg-inverted',
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  /** Filled rather than tinted, for states that must be read at a glance. */
  solid?: boolean;
  className?: string;
  title?: string;
}

export function Badge({
  tone = 'neutral',
  children,
  solid = false,
  className = '',
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap',
        solid ? SOLID[tone] : SOFT[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

/** A small coloured dot, for status that needs a marker but no label. */
export function Dot({ tone = 'neutral', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const fill =
    tone === 'neutral'
      ? 'bg-fg-subtle'
      : tone === 'accent'
        ? 'bg-accent'
        : tone === 'ok'
          ? 'bg-ok'
          : tone === 'info'
            ? 'bg-info'
            : tone === 'caution'
              ? 'bg-caution'
              : tone === 'warning'
                ? 'bg-warning'
                : 'bg-critical';
  return (
    <span
      aria-hidden
      className={[
        'inline-block size-2 shrink-0 rounded-full',
        fill,
        pulse ? 'animate-pulse' : '',
      ].join(' ')}
    />
  );
}
