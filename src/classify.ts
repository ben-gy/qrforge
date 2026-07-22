// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Classify a decoded QR value into a friendly kind + optional action.
 *
 * Pure and unit-tested — the scan UI relies on it to decide what to show and
 * whether to offer an "open" button, and mislabelling (e.g. treating a WiFi
 * string as a URL) would be a confusing footgun.
 */

export type ScanKind = 'url' | 'wifi' | 'tel' | 'sms' | 'email' | 'geo' | 'vcard' | 'text';

export interface ScanAction {
  href: string;
  label: string;
}

export interface Classified {
  kind: ScanKind;
  /** Short human label of what the code is. */
  label: string;
  /** A safe action to offer, when one applies. */
  action?: ScanAction;
}

/** Pull the SSID out of a WIFI: payload for display (best-effort). */
function wifiSsid(value: string): string {
  const m = value.match(/(?:^|;)S:((?:\\.|[^\\;])*)/);
  if (!m) return '';
  return m[1].replace(/\\(.)/g, '$1');
}

export function classifyScan(value: string): Classified {
  const v = value.trim();

  if (/^WIFI:/i.test(v)) {
    const ssid = wifiSsid(v);
    return { kind: 'wifi', label: ssid ? `WiFi network “${ssid}”` : 'WiFi network' };
  }
  if (/^BEGIN:VCARD/i.test(v)) {
    return { kind: 'vcard', label: 'Contact card (vCard)' };
  }
  if (/^tel:/i.test(v)) {
    return { kind: 'tel', label: 'Phone number', action: { href: v, label: 'Call' } };
  }
  if (/^smsto:/i.test(v) || /^sms:/i.test(v)) {
    return { kind: 'sms', label: 'SMS message' };
  }
  if (/^mailto:/i.test(v)) {
    return { kind: 'email', label: 'Email', action: { href: v, label: 'Compose' } };
  }
  if (/^geo:/i.test(v)) {
    return { kind: 'geo', label: 'Location' };
  }
  if (/^https?:\/\//i.test(v)) {
    return { kind: 'url', label: 'Website link', action: { href: v, label: 'Open link' } };
  }
  // Bare domain like example.com/path — treat as a link but don't auto-scheme
  // into an action unless it clearly looks like a host.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v) && !v.includes(' ')) {
    return { kind: 'url', label: 'Website link', action: { href: `https://${v}`, label: 'Open link' } };
  }
  return { kind: 'text', label: 'Plain text' };
}
