import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './Button';

export interface SheetProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet for the mobile shell.
 *
 * A sheet rather than a centred modal because the actions it holds (version history, keywords,
 * destructive operations) are all one-handed reach on a phone.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  // Escape closes it, matching the keyboard behaviour of every other dialog in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="sheet fixed inset-0 z-[1300] flex flex-col justify-end">
      {/*
        A plain div rather than a button: the sheet already offers Escape and an explicit close
        control, and a second button named "关闭" would make the accessible name ambiguous.
      */}
      <div aria-hidden className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="sheet__panel relative flex max-h-[85vh] flex-col rounded-t-2xl border-t border-line bg-surface-1"
      >
        <div className="sheet__header flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <IconButton label="关闭" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="sheet__body scrollbar-slim flex-1 overflow-y-auto px-4 py-4 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
