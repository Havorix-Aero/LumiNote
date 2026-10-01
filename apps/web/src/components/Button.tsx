import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'default' | 'ghost' | 'danger' | 'dangerSolid';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg border border-transparent hover:bg-accent-hover disabled:hover:bg-accent',
  default:
    'bg-surface-1 text-fg border border-line hover:bg-surface-2 hover:border-line-strong disabled:hover:bg-surface-1',
  ghost:
    'bg-transparent text-fg-muted border border-transparent hover:bg-surface-2 hover:text-fg disabled:hover:bg-transparent',
  danger:
    'bg-surface-1 text-critical border border-critical/50 hover:bg-critical-soft disabled:hover:bg-surface-1',
  dangerSolid: 'bg-critical text-fg-inverted border border-transparent hover:brightness-110',
};

/*
 * `sm` is 32px and `md` is 36px tall, both below the 44px touch guideline, so the mobile shell
 * passes `size="lg"` (44px) for anything a thumb has to hit.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button, so a form cannot be submitted twice. */
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'default',
    size = 'md',
    loading = false,
    block = false,
    icon,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      className={[
        'inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/** Inline spinner sized to the surrounding text, so it works inside any button. */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="加载中"
      className={[
        'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      ].join(' ')}
    />
  );
}

/** Small round icon-only button used in headers and toolbars. */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      aria-label={label}
      title={label}
      className={[
        'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent',
        'text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
});
