import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  hint?: string;
}

export interface TabBarProps {
  items: readonly TabItem[];
  value: string;
  onChange: (key: string) => void;
  /** `lg` is for the mobile shell, where the tabs are the only navigation. */
  size?: 'md' | 'lg';
}

/** Underline tabs for module-level navigation ("历史 | 设置"). */
export function TabBar({ items, value, onChange, size = 'md' }: TabBarProps) {
  return (
    <div
      role="tablist"
      className="scrollbar-slim flex items-center gap-1 overflow-x-auto border-b border-line"
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            title={item.hint}
            onClick={() => onChange(item.key)}
            className={[
              'relative shrink-0 cursor-pointer rounded-t-lg border-b-2 font-medium whitespace-nowrap transition-colors',
              size === 'lg' ? 'min-h-11 px-4 py-2.5 text-base' : 'min-h-9 px-3.5 py-2 text-sm',
              active
                ? 'border-accent text-accent-ink'
                : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
              item.disabled ? 'cursor-not-allowed opacity-45' : '',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {item.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: ReactNode; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact segmented control for view switches. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      className={['inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className].join(
        ' ',
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.hint}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={[
            'cursor-pointer rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
            option.value === value
              ? 'bg-surface-1 text-fg ring-1 ring-line-strong'
              : 'text-fg-muted hover:text-fg',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
