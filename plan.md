# Tool Plan: QRForge

## Overview
- **Name:** QRForge
- **Repo name:** qrforge
- **Tagline:** Generate tracking-free QR codes and scan them — entirely in your browser.

## Problem It Solves
You need a QR code — for your café's WiFi, an event flyer, a business card, a link on a poster. You search "QR code generator" and land on sites that (a) route your code through *their* redirect domain so they can track every scan and can kill the code if you stop paying, (b) make you sign up, or (c) watermark it. For scanning, the story is worse: "scan QR from image" sites want you to upload the picture. QRForge does both jobs locally: it generates a **direct** QR code (the data is baked into the code, no redirect, no expiry, no tracking) and scans codes from an image or your camera without anything leaving the device.

## Why This Must Be Client-Side
- **Privacy:** a QR for your home WiFi password or a vCard with your phone number should never touch a server; scanning a code from a photo shouldn't upload the photo.
- **No dark patterns:** offline generation means no tracking-redirect middleman, no expiring codes, no account.
- **Offline:** generate and scan on a plane, at a market stall, anywhere.

## Browser APIs / Libraries Used
| API / Library | What it does for us | Fallback if unsupported |
|---------------|----------------------|-------------------------|
| BarcodeDetector API | Native, fast QR scanning from image/video | jsQR (pure-JS) fallback |
| getUserMedia (camera) | Live camera scanning | Image-upload scanning still works |
| Canvas 2D | Render PNG, grab video frames for scanning | N/A |
| MediaStream ImageCapture / track torch | Optional flashlight while scanning | Hidden when unsupported |
| Clipboard API | Copy PNG / copy decoded text | Download fallback |
| Web Share API | Share the code image on mobile | Download fallback |
| qrcode (lib) | QR matrix generation → SVG + Canvas | N/A — core dependency |

## Workflow (input -> process -> output)
1. **Generate:** pick a content type (URL, text, WiFi, contact, email, SMS, phone, geo), fill the form → a live QR preview updates → tune error-correction, size, colours, quiet-zone → download SVG/PNG, copy, or share.
2. **Scan:** drop/pick an image *or* start the camera → the code is detected on-device → the decoded value is shown with smart actions (open link, copy, add-to-contacts hint).

## Non-Goals
- No dynamic/editable QR (that requires a redirect server — the opposite of the point).
- No bulk CSV → 500-codes generation in v1.
- No account, no cloud, ever.

## Target Audience
A café owner making a "scan for WiFi" table card; a stallholder linking to their shop; a privacy-aware person who refuses tracking-redirect QR farms. Non-technical, on a phone or laptop, wants a clean code and no sign-up.

## Style Direction
**Tone:** friendly, clean, trustworthy.
**Colour palette:** light, warm-white surfaces with a single confident indigo brand accent — reads approachable and safe for a general/consumer audience.
**UI density:** spacious.
**Dark/light theme:** light (consumer audience per the factory's audience-first guidance).
**Reference tools for feel:** the clean generators people wish existed without the paywall — qr-code-generator.com minus the dark patterns.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite. Two simple modes (generate/scan), no heavy state orchestration.
- **Key libraries:** `qrcode` (generation), `jsqr` (scan fallback).
- **Worker strategy:** main-thread — generation and per-frame detection are fast; no CPU-heavy step needs a worker.
- **Storage:** localStorage for last-used options (colour, ECC, size). No user content stored.

## Privacy & Trust Model
**Protected**
- Everything you type (WiFi passwords, phone numbers, links) — turned into a QR entirely on-device.
- Images you scan and camera frames — decoded locally, never uploaded.
- The generated code contains your data *directly* — no third-party redirect, so nobody can log scans.

**Not protected**
- The QR code *is* the data — anyone who can see/scan it reads its contents (don't post a WiFi-password code publicly).
- Loading the page is logged by GitHub Pages' CDN, like any website.

**Trust surface**
- The static site bundle (GitHub Pages, hash-pinned per deploy) and the TLS chain.
- No runtime network calls at all — the CSP forbids `connect-src` to anything but self. Once loaded, it works fully offline.

## UX Required Surfaces
- Mode switch: Generate / Scan.
- Generate: type picker, dynamic form, live preview, ECC/size/colour/margin controls.
- Scan: image drop zone + live camera with torch toggle; decoded-result card with actions.
- Determinate feedback where relevant; scanning shows a live "searching…" state.
- Event log drawer, How-It-Works modal, Threat Model modal, About modal.
- Output: download SVG + PNG, copy, Web Share.
- Keyboard: Escape (close/stop), Enter (generate), Cmd/Ctrl+V (paste text/image).
- Sticky footer "Built by benrichardson.dev".
