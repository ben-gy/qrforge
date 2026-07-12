# qrforge

**Generate tracking-free QR codes and scan them — entirely in your browser.**

Live: https://qrforge.benrichardson.dev

---

## what it is

QRForge makes QR codes the honest way. You pick what to encode — a link, plain text, your WiFi, a contact card, an email, an SMS, a phone number or a location — and the code is forged in your browser with your data baked *directly* into it. There is no tracking-redirect middleman, so nobody can log who scans it and it never expires. It also scans codes back: drop an image or point your camera, and the code is decoded on-device.

Most "free" QR generators encode a link to *their* server, which forwards to your real destination — that lets them count every scan and switch the code off if you stop paying. And "scan a QR from a picture" sites want you to upload the photo. QRForge needs neither: it makes zero network calls at runtime.

It's for the café owner making a "scan for WiFi" card, the stallholder linking to their shop, and anyone who would rather not route their data through a QR farm.

## how it works

```
Generate:  form fields ─▶ standard payload string ─▶ QR matrix ─▶ SVG / PNG
Scan:      image / camera frame ─▶ canvas ─▶ BarcodeDetector (or jsQR) ─▶ value
```

- **Payloads** are built to each format's spec — `WIFI:...;;` with proper escaping, vCard 3.0, `mailto:`, `SMSTO:`, `tel:`, `geo:` — so real phones join the network or add the contact in one tap.
- **Generation** runs [node-qrcode](https://github.com/soldair/node-qrcode) locally and renders a crisp SVG (vector, prints at any size) or a PNG.
- **Scanning** uses the browser's native [BarcodeDetector](https://developer.mozilla.org/docs/Web/API/BarcodeDetector) where available, falling back to the pure-JavaScript [jsQR](https://github.com/cozmo/jsQR). The image and every camera frame stay on your device.

## browser APIs used

- **BarcodeDetector API** — native, fast QR decoding from images and video (jsQR fallback).
- **getUserMedia** — live camera scanning.
- **Canvas 2D** — render PNGs and grab video frames for decoding.
- **Clipboard API** — copy the code image or the decoded text.
- **Web Share API** — share the code on mobile.
- **Service Worker** — offline app shell (PWA); once loaded, everything works with no network.

## security / privacy model

**Protected**
- Everything you type — WiFi passwords, phone numbers, links — becomes a QR entirely on-device.
- Images you scan and every camera frame — decoded locally, never uploaded.
- Your codes are *direct*: the data lives inside the code, with no third-party redirect that could log scans or expire it.

**Not protected**
- The QR code *is* the data — anyone who can see or scan it can read its contents, so don't publicly post a code that contains a secret.
- Loading the page is logged by GitHub Pages' CDN, like visiting any website.

**Trust model**
- The static site bundle served by GitHub Pages (hash-pinned per deploy) and the TLS chain.
- Nothing else — the page makes **zero** network calls at runtime, enforced by a Content-Security-Policy that forbids `connect-src` beyond `self`. It works fully offline once loaded.

## stack

- Vite 6 + vanilla TypeScript
- `qrcode` (generation) and `jsqr` (fallback scanning)
- Vitest for unit tests
- GitHub Pages for hosting, deployed via GitHub Actions

No cookies, no fingerprinting, no third-party fonts. Anonymous, cookie-less page-view counts via Cloudflare Web Analytics — no personal data, no cross-site tracking.

## local development

```bash
npm install
npm run dev      # vite dev server on :5173
npm test         # run vitest suite
npm run build    # produce dist/ for deploy
npm run preview  # serve dist/ locally
```

## deploying

A push to `main` triggers `.github/workflows/deploy.yml`, which runs tests, builds, and deploys `dist/` to GitHub Pages. The custom domain is set via `public/CNAME` — point a `CNAME` DNS record for `qrforge.benrichardson.dev` at `ben-gy.github.io`.

## license

MIT — see [LICENSE](./LICENSE).
