export function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function supportsCanvas(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext && canvas.getContext('2d'));
}

export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 2;
  return Boolean((memory && memory <= 3) || cores <= 4);
}

export function applyDeviceClasses(): () => void {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return () => {};

  const userAgent = navigator.userAgent;
  const root = document.documentElement;
  const isIpadOsDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const classes = [
    /iPad|iPhone|iPod/i.test(userAgent) || isIpadOsDesktopMode ? 'is-ios' : '',
    /Android/i.test(userAgent) ? 'is-android' : '',
    isLowPowerDevice() ? 'is-low-power' : '',
    /MicroMessenger/i.test(userAgent) ? 'browser-wechat' : '',
    /SamsungBrowser|SM-/i.test(userAgent) ? 'brand-samsung' : '',
    /HuaweiBrowser|HUAWEI|HONOR/i.test(userAgent) ? 'brand-huawei' : '',
    /MiuiBrowser|XiaoMi|Redmi/i.test(userAgent) ? 'brand-xiaomi' : '',
    /HeyTapBrowser|OppoBrowser|OPPO/i.test(userAgent) ? 'brand-oppo' : '',
    /VivoBrowser|Vivo/i.test(userAgent) ? 'brand-vivo' : ''
  ].filter(Boolean);

  if (classes.length) root.classList.add(...classes);

  return () => {
    if (classes.length) root.classList.remove(...classes);
  };
}
