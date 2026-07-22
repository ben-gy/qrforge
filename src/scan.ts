// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * QR scanning — native BarcodeDetector where available, jsQR fallback.
 *
 * The browser-facing half of the tool. Detection always runs on-device: an
 * image or a camera frame is drawn to a canvas and decoded here; nothing is
 * uploaded.
 */

import jsQR from 'jsqr';

export interface ScanResult {
  value: string;
  engine: 'BarcodeDetector' | 'jsQR';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDetector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
let nativeDetector: AnyDetector | null | undefined;

/** True when the browser exposes a usable BarcodeDetector for QR codes. */
export function nativeAvailable(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

function getNative(): AnyDetector | null {
  if (nativeDetector !== undefined) return nativeDetector;
  try {
    if (nativeAvailable()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    } else {
      nativeDetector = null;
    }
  } catch {
    nativeDetector = null;
  }
  return nativeDetector ?? null;
}

export function engineName(): 'BarcodeDetector' | 'jsQR' {
  return getNative() ? 'BarcodeDetector' : 'jsQR';
}

/**
 * Detect a QR code from a canvas that already holds the image/frame. Tries the
 * native detector first (fast, robust), then falls back to jsQR over the pixel
 * data. Returns null when nothing is found.
 */
export async function detectFromCanvas(canvas: HTMLCanvasElement): Promise<ScanResult | null> {
  const native = getNative();
  if (native) {
    try {
      const codes = await native.detect(canvas);
      if (codes && codes.length && codes[0].rawValue) {
        return { value: codes[0].rawValue, engine: 'BarcodeDetector' };
      }
    } catch {
      // fall through to jsQR
    }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  if (width === 0 || height === 0) return null;
  const imageData = ctx.getImageData(0, 0, width, height);
  const result = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
  if (result && result.data) {
    return { value: result.data, engine: 'jsQR' };
  }
  return null;
}
