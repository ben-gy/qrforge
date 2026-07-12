import { describe, expect, it } from 'vitest';
import { classifyScan } from '../src/classify';

describe('classifyScan', () => {
  it('classifies an https URL with an open action', () => {
    const c = classifyScan('https://example.com/x');
    expect(c.kind).toBe('url');
    expect(c.action?.href).toBe('https://example.com/x');
  });
  it('classifies a bare domain and schemes it for the action', () => {
    const c = classifyScan('example.com/path');
    expect(c.kind).toBe('url');
    expect(c.action?.href).toBe('https://example.com/path');
  });
  it('classifies WiFi and extracts the SSID', () => {
    const c = classifyScan('WIFI:T:WPA;S:My\\;Cafe;P:pw;;');
    expect(c.kind).toBe('wifi');
    expect(c.label).toContain('My;Cafe');
  });
  it('classifies a vCard', () => {
    const c = classifyScan('BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nEND:VCARD');
    expect(c.kind).toBe('vcard');
  });
  it('classifies tel and offers a Call action', () => {
    const c = classifyScan('tel:+15551234');
    expect(c.kind).toBe('tel');
    expect(c.action?.label).toBe('Call');
  });
  it('classifies mailto and smsto and geo', () => {
    expect(classifyScan('mailto:a@b.com').kind).toBe('email');
    expect(classifyScan('SMSTO:+1555:hi').kind).toBe('sms');
    expect(classifyScan('geo:1,2').kind).toBe('geo');
  });
  it('falls back to plain text', () => {
    const c = classifyScan('just some words here');
    expect(c.kind).toBe('text');
    expect(c.action).toBeUndefined();
  });
  it('does not treat text with spaces as a URL', () => {
    expect(classifyScan('hello world.txt file').kind).toBe('text');
  });
});
