import { MOBILE_LAYOUT_QUERY } from '../lib/device';
import { useSettings } from '../lib/settings';
import { useMediaQuery } from './useMediaQuery';

/**
 * Which shell to render.
 *
 * The `auto` setting follows the viewport, so this subscribes to the media query rather than
 * sampling it once: rotating a phone (or dragging a desktop window narrow) re-renders the correct
 * shell instead of leaving the previous one in place until the next reload.
 */
export function useLayout(): 'desktop' | 'mobile' {
  const settings = useSettings();
  const viewportIsMobile = useMediaQuery(MOBILE_LAYOUT_QUERY);

  if (settings.layout === 'desktop') return 'desktop';
  if (settings.layout === 'mobile') return 'mobile';
  return viewportIsMobile ? 'mobile' : 'desktop';
}
