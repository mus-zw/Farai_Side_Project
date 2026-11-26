/**
 * Checkout links come from environment variables, so a payment provider
 * (Paystack, Dodo, Stripe...) can be swapped without code changes. Only plain
 * https links are ever opened.
 */

/**
 * A checkout URL for `plan`, or null if none is configured or it is not a safe
 * https URL. A `{plan}` placeholder in the configured value is replaced with the
 * plan id, so one link can serve several plans if the provider supports it.
 */
export function resolveCheckoutUrl(template: string | undefined, plan: string): string | null {
  const raw = (template ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/\{plan\}/g, encodeURIComponent(plan)));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const CV_CHECKOUT_URL: string | undefined = import.meta.env.VITE_CV_CHECKOUT_URL;
export const FITNESS_CHECKOUT_ZAR_URL: string | undefined = import.meta.env.VITE_FITNESS_CHECKOUT_ZAR_URL;
export const FITNESS_CHECKOUT_USD_URL: string | undefined = import.meta.env.VITE_FITNESS_CHECKOUT_USD_URL;
export const LICENSE_PUBLIC_KEY: string | undefined = import.meta.env.VITE_LICENSE_PUBLIC_KEY;

/** The "demo unlock" switch is for development and testing, never on by default in production. */
export const DEMO_UNLOCK_ENABLED: boolean = Boolean(import.meta.env.DEV) || import.meta.env.VITE_ENABLE_DEMO_UNLOCK === 'true';
