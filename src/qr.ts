/**
 * QR generation wrapper around node-qrcode.
 *
 * Keeps the library's option-shape in one place and normalises errors (the
 * library throws when the data is too long for even the largest version at the
 * chosen error-correction level).
 */

import QRCode from 'qrcode';
import type { QrOptions } from './types';

function libOptions(opts: QrOptions) {
  return {
    errorCorrectionLevel: opts.ecc,
    margin: opts.margin,
    color: { dark: opts.dark, light: opts.light },
    width: opts.size,
  };
}

export class QrTooLongError extends Error {
  constructor() {
    super('That is too much data for a single QR code. Shorten it or lower the error-correction level.');
    this.name = 'QrTooLongError';
  }
}

function wrap(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (/too (big|long)|code length overflow|data too long/i.test(msg)) throw new QrTooLongError();
  throw err instanceof Error ? err : new Error(msg);
}

/** Render to a standalone SVG string. */
export async function toSvgString(data: string, opts: QrOptions): Promise<string> {
  try {
    return await QRCode.toString(data, { type: 'svg', ...libOptions(opts) });
  } catch (err) {
    wrap(err);
  }
}

/** Render into an existing <canvas>. */
export async function toCanvas(canvas: HTMLCanvasElement, data: string, opts: QrOptions): Promise<void> {
  try {
    await QRCode.toCanvas(canvas, data, libOptions(opts));
  } catch (err) {
    wrap(err);
  }
}

/** Render to a PNG data URL. */
export async function toPngDataUrl(data: string, opts: QrOptions): Promise<string> {
  try {
    return await QRCode.toDataURL(data, { type: 'image/png', ...libOptions(opts) });
  } catch (err) {
    wrap(err);
  }
}
