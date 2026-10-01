import { forwardRef, useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/*
 * The shared control skin. `bg-surface-1` rather than a dedicated input colour keeps inputs the
 * same value as the card they sit on in both themes; the border carries the affordance instead.
 * `text-base` on small screens would be 15px, which iOS zooms on focus, so inputs are pinned to
 * 16px and only shrink to 14px from the `sm` breakpoint up.
 */
const FIELD_BASE =
  'w-full rounded-lg border bg-surface-1 px-3 text-base text-fg placeholder:text-fg-subtle ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent ' +
  'disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-subtle sm:text-sm';

/*
 * 44px tall: the WCAG target size, and taller than `text-base` alone would be. Inputs are the one
 * control a thumb always has to hit, so they take the touch height everywhere rather than only
 * below the mobile breakpoint.
 */
const FIELD_HEIGHT = 'h-11';

function stateClass(error?: string): string {
  return error ? 'border-critical' : 'border-line hover:border-line-strong';
}

export interface FieldProps {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; className: string }) => ReactNode;
}

/** The one place that knows how a label, a control and its message are arranged. */
export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-fg-muted">
          {label}
          {required ? <span className="ml-0.5 text-critical">*</span> : null}
        </label>
      ) : null}
      {children({
        id,
        'aria-invalid': Boolean(error),
        className: `${FIELD_BASE} ${stateClass(error)}`,
      })}
      {error ? (
        <p className="text-xs text-critical">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, hint, required, className = '', ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, className: fieldClass, ...aria }) => (
        <input
          ref={ref}
          id={id}
          className={`${fieldClass} ${FIELD_HEIGHT} ${className}`}
          required={required}
          {...aria}
          {...rest}
        />
      )}
    </Field>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, required, className = '', rows = 3, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, className: fieldClass, ...aria }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={`${fieldClass} py-2 ${className}`}
          required={required}
          {...aria}
          {...rest}
        />
      )}
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, required, options, placeholder, className = '', ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, className: fieldClass, ...aria }) => (
        <select
          ref={ref}
          id={id}
          className={`${fieldClass} ${FIELD_HEIGHT} cursor-pointer ${className}`}
          required={required}
          {...aria}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
});

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  /** Touch surfaces use the larger track so the target clears 44px. */
  size?: 'md' | 'lg';
}

export function Switch({ checked, onChange, label, hint, disabled, size = 'md' }: SwitchProps) {
  const id = useId();
  const track = size === 'lg' ? 'h-7 w-13' : 'h-6 w-11';
  const knob = size === 'lg' ? 'size-5' : 'size-4';
  const shift = size === 'lg' ? 'translate-x-6' : 'translate-x-5';

  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative shrink-0 rounded-full border transition-colors',
          track,
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-3',
          disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'absolute top-1/2 left-0.5 -translate-y-1/2 rounded-full bg-surface-1 transition-transform',
            knob,
            checked ? shift : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-sm text-fg">
          {label}
          {hint ? <span className="mt-0.5 block text-xs text-fg-subtle">{hint}</span> : null}
        </label>
      ) : null}
    </div>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

/**
 * A checkbox plus its label as one 44px row.
 *
 * The `checkbox` class is load-bearing beyond styling: the end-to-end suite uses `label.checkbox`
 * to find these rows.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className = '', ...rest },
  ref,
) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={[
        'checkbox flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-fg',
        'hover:bg-surface-2',
        className,
      ].join(' ')}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
        {...rest}
      />
      <span className="min-w-0">
        {label}
        {hint ? <span className="mt-0.5 block text-xs text-fg-subtle">{hint}</span> : null}
      </span>
    </label>
  );
});
