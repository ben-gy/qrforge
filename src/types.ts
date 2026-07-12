/** Shared types. */

export type PayloadType = 'url' | 'text' | 'wifi' | 'vcard' | 'email' | 'sms' | 'tel' | 'geo';

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  ecc: EccLevel;
  /** Pixel size of the rendered PNG (SVG scales freely). */
  size: number;
  /** Quiet-zone width in modules. */
  margin: number;
  dark: string;
  light: string;
}

export interface WifiFields {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface VCardFields {
  first: string;
  last: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
  note: string;
}

export interface EmailFields {
  to: string;
  subject: string;
  body: string;
}

export interface SmsFields {
  number: string;
  message: string;
}

export interface GeoFields {
  lat: string;
  lng: string;
}
