import { describe, expect, it } from 'vitest';
import {
  buildEmail,
  buildGeo,
  buildSms,
  buildTel,
  buildText,
  buildUrl,
  buildVcard,
  buildWifi,
  escapeVcard,
  escapeWifi,
  normalizeUrl,
} from '../src/payloads';

describe('escapeWifi', () => {
  it('escapes the five special characters', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
  });
  it('leaves ordinary text alone', () => {
    expect(escapeWifi('MyNetwork 5G')).toBe('MyNetwork 5G');
  });
});

describe('buildWifi', () => {
  it('builds a WPA payload with password', () => {
    expect(buildWifi({ ssid: 'Cafe', password: 'pw123', encryption: 'WPA', hidden: false })).toBe(
      'WIFI:T:WPA;S:Cafe;P:pw123;;',
    );
  });
  it('omits the password for an open network', () => {
    expect(buildWifi({ ssid: 'Free', password: 'ignored', encryption: 'nopass', hidden: false })).toBe(
      'WIFI:T:nopass;S:Free;;',
    );
  });
  it('adds the hidden flag', () => {
    expect(buildWifi({ ssid: 'X', password: 'y', encryption: 'WPA', hidden: true })).toBe(
      'WIFI:T:WPA;S:X;P:y;H:true;;',
    );
  });
  it('escapes special characters in ssid and password', () => {
    expect(buildWifi({ ssid: 'My;Net', password: 'a:b', encryption: 'WPA', hidden: false })).toBe(
      'WIFI:T:WPA;S:My\\;Net;P:a\\:b;;',
    );
  });
  it('returns empty when ssid is blank', () => {
    expect(buildWifi({ ssid: '  ', password: 'x', encryption: 'WPA', hidden: false })).toBe('');
  });
});

describe('escapeVcard', () => {
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeVcard('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});

describe('buildVcard', () => {
  it('produces a well-formed vCard with only filled fields', () => {
    const out = buildVcard({
      first: 'Ada',
      last: 'Lovelace',
      org: 'Analytical Engines',
      title: '',
      phone: '+15551234',
      email: 'ada@example.com',
      url: 'example.com',
      address: '',
      note: '',
    });
    expect(out).toContain('BEGIN:VCARD');
    expect(out).toContain('VERSION:3.0');
    expect(out).toContain('N:Lovelace;Ada;;;');
    expect(out).toContain('FN:Ada Lovelace');
    expect(out).toContain('ORG:Analytical Engines');
    expect(out).toContain('TEL;TYPE=CELL:+15551234');
    expect(out).toContain('EMAIL:ada@example.com');
    expect(out).toContain('URL:https://example.com');
    expect(out).not.toContain('TITLE:');
    expect(out.endsWith('END:VCARD')).toBe(true);
  });
  it('falls back to org for FN when no name given', () => {
    const out = buildVcard({
      first: '',
      last: '',
      org: 'ACME',
      title: '',
      phone: '',
      email: 'x@y.z',
      url: '',
      address: '',
      note: '',
    });
    expect(out).toContain('FN:ACME');
  });
  it('returns empty when nothing meaningful is provided', () => {
    expect(
      buildVcard({ first: '', last: '', org: '', title: 'Boss', phone: '', email: '', url: '', address: '', note: 'hi' }),
    ).toBe('');
  });
});

describe('buildEmail', () => {
  it('builds a bare mailto', () => {
    expect(buildEmail({ to: 'a@b.com', subject: '', body: '' })).toBe('mailto:a@b.com');
  });
  it('encodes subject and body', () => {
    expect(buildEmail({ to: 'a@b.com', subject: 'Hi there', body: 'a & b' })).toBe(
      'mailto:a@b.com?subject=Hi%20there&body=a%20%26%20b',
    );
  });
  it('returns empty without a recipient', () => {
    expect(buildEmail({ to: '', subject: 's', body: 'b' })).toBe('');
  });
});

describe('buildSms', () => {
  it('builds SMSTO with a message', () => {
    expect(buildSms({ number: '+15550001', message: 'yo' })).toBe('SMSTO:+15550001:yo');
  });
  it('builds SMSTO without a message', () => {
    expect(buildSms({ number: '+15550001', message: '' })).toBe('SMSTO:+15550001');
  });
  it('returns empty without a number', () => {
    expect(buildSms({ number: '', message: 'x' })).toBe('');
  });
});

describe('buildTel', () => {
  it('prefixes tel:', () => {
    expect(buildTel(' +1 555 000 ')).toBe('tel:+1 555 000');
  });
  it('returns empty for blank', () => {
    expect(buildTel('  ')).toBe('');
  });
});

describe('buildGeo', () => {
  it('builds a geo URI', () => {
    expect(buildGeo({ lat: '37.7749', lng: '-122.4194' })).toBe('geo:37.7749,-122.4194');
  });
  it('rejects out-of-range coordinates', () => {
    expect(buildGeo({ lat: '200', lng: '0' })).toBe('');
    expect(buildGeo({ lat: '0', lng: '999' })).toBe('');
  });
  it('rejects non-numeric input', () => {
    expect(buildGeo({ lat: 'north', lng: '0' })).toBe('');
    expect(buildGeo({ lat: '', lng: '' })).toBe('');
  });
});

describe('normalizeUrl / buildUrl', () => {
  it('adds https:// when no scheme', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(buildUrl('example.com/path?x=1')).toBe('https://example.com/path?x=1');
  });
  it('leaves an existing scheme untouched', () => {
    expect(normalizeUrl('http://x.com')).toBe('http://x.com');
    expect(normalizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(normalizeUrl('ftp://f.example')).toBe('ftp://f.example');
  });
  it('returns empty for blank', () => {
    expect(normalizeUrl('   ')).toBe('');
  });
});

describe('buildText', () => {
  it('keeps text verbatim but trims trailing whitespace', () => {
    expect(buildText('hello world  \n')).toBe('hello world');
  });
});
