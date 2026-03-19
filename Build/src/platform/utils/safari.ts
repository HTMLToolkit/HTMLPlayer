export function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const isSafari = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
  const isWebKit = ua.includes("applewebkit") && !ua.includes("chrome");
  return isSafari || isWebKit;
}
