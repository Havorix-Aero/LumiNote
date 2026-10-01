import type { DevicePlatform } from '@luminote/core';

export interface DeviceInfo {
  platform: DevicePlatform;
  label: string;
}

export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const isIPadOs = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const isIPhoneLike = /iphone|ipad|ipod/i.test(ua) || isIPadOs;
  const isAndroid = /android/i.test(ua);

  if (isIPhoneLike) return { platform: 'ios', label: 'iOS 设备' };
  if (isAndroid) return { platform: 'android', label: 'Android 设备' };
  return { platform: 'web-desktop', label: '桌面浏览器' };
}

export const MOBILE_LAYOUT_QUERY = '(max-width: 820px), (pointer: coarse) and (max-width: 1024px)';

/** Layout is chosen by viewport, with an explicit user override available in settings. */
export function prefersMobileLayout(): boolean {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}
