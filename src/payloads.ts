// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Payload builders — turn structured form fields into the exact string a QR
 * reader expects for each content type.
 *
 * These are the heart of the tool and are all pure: escaping bugs here would
 * silently break real WiFi joins or contact imports, so every builder is
 * unit-tested against the relevant format's escaping rules.
 */

import type {
  EmailFields,
  GeoFields,
  SmsFields,
  VCardFields,
  WifiFields,
} from './types';

/**
 * Escape a value for the WiFi payload format. Special characters
 * `\ ; , : "` must each be prefixed with a backslash.
 */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/**
 * Build a `WIFI:...;;` payload. Empty SSID yields an empty string (nothing to
 * encode). `nopass` networks omit the password field entirely.
 */
export function buildWifi(f: WifiFields): string {
  const ssid = f.ssid.trim();
  if (!ssid) return '';
  const parts = [`T:${f.encryption}`, `S:${escapeWifi(ssid)}`];
  if (f.encryption !== 'nopass') {
    parts.push(`P:${escapeWifi(f.password)}`);
  }
  if (f.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/** Escape a value for a vCard field (`\ ; , ` and newlines). */
export function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Build a vCard 3.0 payload. Only non-empty fields are emitted. */
export function buildVcard(f: VCardFields): string {
  const first = f.first.trim();
  const last = f.last.trim();
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  // Nothing meaningful to encode.
  if (!fullName && !f.org.trim() && !f.phone.trim() && !f.email.trim()) return '';

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
  lines.push(`FN:${escapeVcard(fullName || f.org.trim())}`);
  if (f.org.trim()) lines.push(`ORG:${escapeVcard(f.org.trim())}`);
  if (f.title.trim()) lines.push(`TITLE:${escapeVcard(f.title.trim())}`);
  if (f.phone.trim()) lines.push(`TEL;TYPE=CELL:${escapeVcard(f.phone.trim())}`);
  if (f.email.trim()) lines.push(`EMAIL:${escapeVcard(f.email.trim())}`);
  if (f.url.trim()) lines.push(`URL:${escapeVcard(normalizeUrl(f.url.trim()))}`);
  if (f.address.trim()) lines.push(`ADR;TYPE=HOME:;;${escapeVcard(f.address.trim())};;;;`);
  if (f.note.trim()) lines.push(`NOTE:${escapeVcard(f.note.trim())}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/** Build a `mailto:` payload with optional subject/body. */
export function buildEmail(f: EmailFields): string {
  const to = f.to.trim();
  if (!to) return '';
  const params: string[] = [];
  if (f.subject.trim()) params.push(`subject=${encodeURIComponent(f.subject.trim())}`);
  if (f.body.trim()) params.push(`body=${encodeURIComponent(f.body.trim())}`);
  const query = params.length ? `?${params.join('&')}` : '';
  return `mailto:${to}${query}`;
}

/** Build an `SMSTO:number:message` payload (the most widely supported form). */
export function buildSms(f: SmsFields): string {
  const number = f.number.trim();
  if (!number) return '';
  const msg = f.message.trim();
  return msg ? `SMSTO:${number}:${msg}` : `SMSTO:${number}`;
}

/** Build a `tel:` payload. */
export function buildTel(number: string): string {
  const n = number.trim();
  return n ? `tel:${n}` : '';
}

/** Build a `geo:lat,lng` payload. Requires two finite numbers. */
export function buildGeo(f: GeoFields): string {
  const lat = Number(f.lat.trim());
  const lng = Number(f.lng.trim());
  if (!f.lat.trim() || !f.lng.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return '';
  return `geo:${lat},${lng}`;
}

/**
 * Normalise a URL: trim, and prepend `https://` when the user omitted a
 * scheme. Leaves other schemes (mailto:, tel:, ftp:, etc.) untouched.
 */
export function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // already has a scheme
  return `https://${s}`;
}

/** Build a URL payload (adds https:// if missing). */
export function buildUrl(input: string): string {
  return normalizeUrl(input);
}

/** Build a plain-text payload (verbatim, trimmed of trailing whitespace only). */
export function buildText(input: string): string {
  return input.replace(/\s+$/, '');
}
