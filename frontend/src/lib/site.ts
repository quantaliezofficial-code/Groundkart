export const SITE_NAME = 'GroundKart';
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://groundkart.com';

export const absUrl = (path = '/') =>
  SITE_URL + (path.startsWith('/') ? path : '/' + path);

export const SITE_DOMAIN = (() => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return SITE_URL.replace(/^https?:\/\//, '').split('/')[0];
  }
})();

export const SUPPORT_EMAIL = `support@${SITE_DOMAIN}`;
export const PARTNERS_EMAIL = `partners@${SITE_DOMAIN}`;
