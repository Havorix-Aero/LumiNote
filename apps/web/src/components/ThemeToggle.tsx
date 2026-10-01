import { THEME_ICONS, THEME_LABELS, useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';
import { Button } from './Button';
import type { ButtonSize } from './Button';

const ORDER: ThemeMode[] = ['light', 'dark', 'system'];

/** Cycles light → dark → system, which is one tap instead of a menu. */
export function ThemeToggle({
  size = 'sm',
  showLabel = true,
}: {
  size?: ButtonSize;
  showLabel?: boolean;
}) {
  const { mode, setMode } = useTheme();
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] as ThemeMode;

  return (
    <Button
      size={size}
      variant="ghost"
      onClick={() => setMode(next)}
      title={`当前：${THEME_LABELS[mode]}（点击切换为${THEME_LABELS[next]}）`}
      aria-label={`主题：${THEME_LABELS[mode]}`}
    >
      <span aria-hidden>{THEME_ICONS[mode]}</span>
      {showLabel ? <span className="hidden sm:inline">{THEME_LABELS[mode]}</span> : null}
    </Button>
  );
}
