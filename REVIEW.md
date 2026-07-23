# QRForge — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/qrforge/ *(redirects to the custom domain once DNS + cert are live)*
- **Custom domain:** https://qrforge.benrichardson.dev *(live after cert issuance below)*

## What it is

A tracking-free QR code generator + on-device scanner. Generate direct codes
(URL, text, WiFi, vCard contact, email, SMS, phone, geo) and scan codes from an
image or the live camera — all in the browser, zero network calls at runtime.

## DNS setup

Already created in Cloudflare (`benrichardson.dev` zone):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `qrforge` | `ben-gy.github.io` | DNS only (grey cloud) |

If the cert needs re-triggering:
```bash
gh api repos/ben-gy/qrforge/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/qrforge/pages -X PUT -f cname="qrforge.benrichardson.dev"
```
