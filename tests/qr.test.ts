import { describe, expect, it } from 'vitest';
import { toSvgString, toPngDataUrl, QrTooLongError } from '../src/qr';
import type { QrOptions } from '../src/types';

const opts: QrOptions = { ecc: 'M', size: 256, margin: 4, dark: '#000000', light: '#ffffff' };

describe('qr generation', () => {
  it('renders an SVG document for a URL', async () => {
    const svg = await toSvgString('https://example.com', opts);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });

  it('honours the foreground colour in the SVG', async () => {
    const svg = await toSvgString('hello', { ...opts, dark: '#ff0000' });
    expect(svg.toLowerCase()).toContain('#ff0000');
  });

  it('produces a PNG data URL', async () => {
    const url = await toPngDataUrl('hello world', opts);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('throws QrTooLongError when the data cannot fit', async () => {
    const huge = 'x'.repeat(8000); // exceeds max capacity even at ECC L
    await expect(toSvgString(huge, { ...opts, ecc: 'L' })).rejects.toBeInstanceOf(QrTooLongError);
  });
});
