/**
 * QRForge — tracking-free QR generation + on-device scanning.
 *
 * Two modes:
 *   generate → structured form → live QR preview → export
 *   scan     → image or live camera → decode on-device → result
 * No network calls at runtime.
 */

// feedback:begin (managed by hub/scripts/feedback/backfill.mjs)
import { mountFeedback } from './feedback';
mountFeedback();
// feedback:end

import './styles/main.css';
import { emit, mountEventDrawer } from './eventlog';
import {
  clear,
  downloadDataUrl,
  downloadText,
  h,
  icon,
  initModalTriggers,
  mount,
  openModal,
  toast,
  type IconName,
} from './ui';
import { initGlossary } from './glossary';
import {
  buildEmail,
  buildGeo,
  buildSms,
  buildTel,
  buildText,
  buildUrl,
  buildVcard,
  buildWifi,
} from './payloads';
import { toCanvas, toPngDataUrl, toSvgString, QrTooLongError } from './qr';
import { detectFromCanvas, engineName } from './scan';
import { classifyScan } from './classify';
import type { EccLevel, PayloadType, QrOptions } from './types';

// ---------- preferences ----------

const PREFS_KEY = 'qrforge.opts.v1';
const DEFAULT_OPTS: QrOptions = { ecc: 'M', size: 320, margin: 4, dark: '#111827', light: '#ffffff' };

function loadOpts(): QrOptions {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_OPTS, ...(JSON.parse(raw) as Partial<QrOptions>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OPTS };
}
function saveOpts(o: QrOptions): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

// ---------- field model ----------

const fields: Record<string, string> = {
  url: '',
  text: '',
  wifi_ssid: '',
  wifi_password: '',
  wifi_enc: 'WPA',
  wifi_hidden: '',
  vc_first: '',
  vc_last: '',
  vc_org: '',
  vc_title: '',
  vc_phone: '',
  vc_email: '',
  vc_url: '',
  vc_address: '',
  vc_note: '',
  em_to: '',
  em_subject: '',
  em_body: '',
  sms_number: '',
  sms_message: '',
  tel_number: '',
  geo_lat: '',
  geo_lng: '',
};

interface State {
  mode: 'generate' | 'scan';
  type: PayloadType;
  opts: QrOptions;
  payload: string;
  cameraActive: boolean;
}

const state: State = {
  mode: 'generate',
  type: 'url',
  opts: loadOpts(),
  payload: '',
  cameraActive: false,
};

// ---------- payload assembly ----------

function computePayload(): string {
  switch (state.type) {
    case 'url':
      return buildUrl(fields.url);
    case 'text':
      return buildText(fields.text);
    case 'wifi':
      return buildWifi({
        ssid: fields.wifi_ssid,
        password: fields.wifi_password,
        encryption: fields.wifi_enc as 'WPA' | 'WEP' | 'nopass',
        hidden: fields.wifi_hidden === 'on',
      });
    case 'vcard':
      return buildVcard({
        first: fields.vc_first,
        last: fields.vc_last,
        org: fields.vc_org,
        title: fields.vc_title,
        phone: fields.vc_phone,
        email: fields.vc_email,
        url: fields.vc_url,
        address: fields.vc_address,
        note: fields.vc_note,
      });
    case 'email':
      return buildEmail({ to: fields.em_to, subject: fields.em_subject, body: fields.em_body });
    case 'sms':
      return buildSms({ number: fields.sms_number, message: fields.sms_message });
    case 'tel':
      return buildTel(fields.tel_number);
    case 'geo':
      return buildGeo({ lat: fields.geo_lat, lng: fields.geo_lng });
    default:
      return '';
  }
}

// ---------- type registry ----------

const TYPES: Array<{ id: PayloadType; label: string; icon: IconName }> = [
  { id: 'url', label: 'Link', icon: 'link' },
  { id: 'text', label: 'Text', icon: 'text' },
  { id: 'wifi', label: 'WiFi', icon: 'wifi' },
  { id: 'vcard', label: 'Contact', icon: 'contact' },
  { id: 'email', label: 'Email', icon: 'mail' },
  { id: 'sms', label: 'SMS', icon: 'sms' },
  { id: 'tel', label: 'Phone', icon: 'phone' },
  { id: 'geo', label: 'Location', icon: 'geo' },
];

// ---------- rendering ----------

const app = mount();

function render(): void {
  clear(app);
  app.appendChild(renderModeSwitch());
  if (state.mode === 'generate') app.appendChild(renderGenerate());
  else app.appendChild(renderScan());
}

function renderModeSwitch(): HTMLElement {
  const bar = h('div', { class: 'mode-switch', role: 'tablist' });
  const mk = (id: 'generate' | 'scan', label: string, ic: IconName) => {
    const b = h(
      'button',
      { type: 'button', class: `mode-btn ${state.mode === id ? 'on' : ''}`, role: 'tab', 'aria-selected': String(state.mode === id) },
      icon(ic),
      label,
    );
    b.addEventListener('click', () => {
      if (state.mode === id) return;
      stopCamera();
      state.mode = id;
      setStatus('ready', id);
      render();
    });
    return b;
  };
  bar.appendChild(mk('generate', 'Generate', 'bolt'));
  bar.appendChild(mk('scan', 'Scan', 'camera'));
  return bar;
}

// ---------- generate view ----------

let previewCanvas: HTMLCanvasElement | null = null;

function renderGenerate(): HTMLElement {
  const wrap = h('div', { class: 'main-content generate-grid' });

  // Left: form column
  const left = h('div', { class: 'gen-form' });

  const tabs = h('div', { class: 'type-tabs', role: 'group', 'aria-label': 'QR content type' });
  for (const t of TYPES) {
    const b = h('button', { type: 'button', class: `type-tab ${state.type === t.id ? 'on' : ''}`, 'data-type': t.id }, icon(t.icon), t.label);
    b.addEventListener('click', () => {
      state.type = t.id;
      renderFormArea();
      updateTabs();
      updatePreview();
    });
    tabs.appendChild(b);
  }
  left.appendChild(tabs);

  const formArea = h('div', { class: 'form-area', id: 'form-area' });
  left.appendChild(formArea);

  left.appendChild(renderOptions());

  // Right: preview column
  const right = h('div', { class: 'gen-preview' });
  const card = h('div', { class: 'preview-card' });
  const canvas = h('canvas', { class: 'qr-canvas', 'aria-label': 'QR code preview' }) as HTMLCanvasElement;
  previewCanvas = canvas;
  card.appendChild(canvas);
  const placeholder = h('div', { class: 'preview-placeholder', id: 'preview-placeholder' }, 'Fill in the form to forge your code');
  card.appendChild(placeholder);
  right.appendChild(card);

  const payloadRow = h('div', { class: 'payload-readout', id: 'payload-readout' });
  right.appendChild(payloadRow);

  right.appendChild(renderExportBar());

  wrap.appendChild(left);
  wrap.appendChild(right);

  requestAnimationFrame(() => {
    renderFormArea();
    updatePreview();
  });
  return wrap;
}

function updateTabs(): void {
  document.querySelectorAll<HTMLElement>('.type-tab').forEach((el) => {
    el.classList.toggle('on', el.dataset.type === state.type);
  });
}

function input(id: string, placeholder: string, opts: { type?: string; label: string; full?: boolean } ): HTMLElement {
  const group = h('div', { class: `field ${opts.full ? 'full' : ''}` });
  group.appendChild(h('label', { class: 'field-label', for: `f-${id}` }, opts.label));
  const el = h('input', {
    id: `f-${id}`,
    class: 'text-input',
    type: opts.type ?? 'text',
    placeholder,
    value: fields[id] ?? '',
  }) as HTMLInputElement;
  el.addEventListener('input', () => {
    fields[id] = el.value;
    debouncedPreview();
  });
  group.appendChild(el);
  return group;
}

function textarea(id: string, placeholder: string, label: string): HTMLElement {
  const group = h('div', { class: 'field full' });
  group.appendChild(h('label', { class: 'field-label', for: `f-${id}` }, label));
  const el = h('textarea', { id: `f-${id}`, class: 'text-input area', placeholder, rows: '3' }) as HTMLTextAreaElement;
  el.value = fields[id] ?? '';
  el.addEventListener('input', () => {
    fields[id] = el.value;
    debouncedPreview();
  });
  group.appendChild(el);
  return group;
}

function renderFormArea(): void {
  const host = document.getElementById('form-area');
  if (!host) return;
  clear(host);
  const grid = h('div', { class: 'field-grid' });

  switch (state.type) {
    case 'url':
      grid.appendChild(input('url', 'example.com or https://example.com/path', { label: 'Website / link', full: true }));
      break;
    case 'text':
      grid.appendChild(textarea('text', 'Any text you want inside the code', 'Text'));
      break;
    case 'wifi':
      grid.appendChild(input('wifi_ssid', 'Network name (SSID)', { label: 'Network name', full: true }));
      grid.appendChild(input('wifi_password', 'Password', { label: 'Password', type: 'text' }));
      grid.appendChild(renderSelect('wifi_enc', 'Security', [
        { v: 'WPA', l: 'WPA / WPA2 / WPA3' },
        { v: 'WEP', l: 'WEP' },
        { v: 'nopass', l: 'None (open)' },
      ]));
      grid.appendChild(renderCheckbox('wifi_hidden', 'Hidden network'));
      break;
    case 'vcard':
      grid.appendChild(input('vc_first', 'First name', { label: 'First name' }));
      grid.appendChild(input('vc_last', 'Last name', { label: 'Last name' }));
      grid.appendChild(input('vc_phone', 'Phone', { label: 'Phone', type: 'tel' }));
      grid.appendChild(input('vc_email', 'Email', { label: 'Email', type: 'email' }));
      grid.appendChild(input('vc_org', 'Company', { label: 'Company' }));
      grid.appendChild(input('vc_title', 'Job title', { label: 'Job title' }));
      grid.appendChild(input('vc_url', 'Website', { label: 'Website', full: true }));
      grid.appendChild(input('vc_address', 'Address', { label: 'Address', full: true }));
      grid.appendChild(input('vc_note', 'Note', { label: 'Note', full: true }));
      break;
    case 'email':
      grid.appendChild(input('em_to', 'name@example.com', { label: 'To', type: 'email', full: true }));
      grid.appendChild(input('em_subject', 'Subject', { label: 'Subject', full: true }));
      grid.appendChild(textarea('em_body', 'Message body', 'Body'));
      break;
    case 'sms':
      grid.appendChild(input('sms_number', '+1 555 123 4567', { label: 'Phone number', type: 'tel', full: true }));
      grid.appendChild(textarea('sms_message', 'Pre-filled message', 'Message'));
      break;
    case 'tel':
      grid.appendChild(input('tel_number', '+1 555 123 4567', { label: 'Phone number', type: 'tel', full: true }));
      break;
    case 'geo':
      grid.appendChild(input('geo_lat', '37.7749', { label: 'Latitude' }));
      grid.appendChild(input('geo_lng', '-122.4194', { label: 'Longitude' }));
      break;
  }
  host.appendChild(grid);
}

function renderSelect(id: string, label: string, options: Array<{ v: string; l: string }>): HTMLElement {
  const group = h('div', { class: 'field' });
  group.appendChild(h('label', { class: 'field-label', for: `f-${id}` }, label));
  const sel = h('select', { id: `f-${id}`, class: 'select' }) as HTMLSelectElement;
  for (const o of options) {
    const opt = h('option', { value: o.v }, o.l) as HTMLOptionElement;
    if ((fields[id] ?? '') === o.v) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    fields[id] = sel.value;
    updatePreview();
  });
  group.appendChild(sel);
  return group;
}

function renderCheckbox(id: string, label: string): HTMLElement {
  const group = h('div', { class: 'field checkbox-field' });
  const wrap = h('label', { class: 'checkbox' });
  const cb = h('input', { type: 'checkbox', id: `f-${id}` }) as HTMLInputElement;
  cb.checked = fields[id] === 'on';
  cb.addEventListener('change', () => {
    fields[id] = cb.checked ? 'on' : '';
    updatePreview();
  });
  wrap.appendChild(cb);
  wrap.appendChild(h('span', {}, label));
  group.appendChild(wrap);
  return group;
}

function renderOptions(): HTMLElement {
  const details = h('details', { class: 'options-details' });
  const summary = h('summary', {}, 'Appearance & error correction');
  details.appendChild(summary);

  const body = h('div', { class: 'options-body' });

  // ECC
  const eccGroup = h('div', { class: 'field' });
  eccGroup.appendChild(h('label', { class: 'field-label' }, 'Error correction'));
  const eccRow = h('div', { class: 'seg-control', role: 'group', 'aria-label': 'Error correction level' });
  const eccLevels: Array<{ v: EccLevel; l: string }> = [
    { v: 'L', l: 'L' },
    { v: 'M', l: 'M' },
    { v: 'Q', l: 'Q' },
    { v: 'H', l: 'H' },
  ];
  for (const e of eccLevels) {
    const b = h('button', { type: 'button', class: `seg ${state.opts.ecc === e.v ? 'on' : ''}`, 'data-ecc': e.v }, e.l);
    b.addEventListener('click', () => {
      state.opts.ecc = e.v;
      saveOpts(state.opts);
      eccRow.querySelectorAll('.seg').forEach((s) => s.classList.toggle('on', (s as HTMLElement).dataset.ecc === e.v));
      updatePreview();
    });
    eccRow.appendChild(b);
  }
  eccGroup.appendChild(eccRow);
  body.appendChild(eccGroup);

  // Size
  const sizeGroup = h('div', { class: 'field' });
  const sizeLabel = h('label', { class: 'field-label' }, `Size — ${state.opts.size}px`);
  sizeGroup.appendChild(sizeLabel);
  const sizeRange = h('input', { type: 'range', min: '160', max: '1024', step: '16', value: String(state.opts.size), class: 'range' }) as HTMLInputElement;
  sizeRange.addEventListener('input', () => {
    state.opts.size = Number(sizeRange.value);
    sizeLabel.textContent = `Size — ${state.opts.size}px`;
    saveOpts(state.opts);
    debouncedPreview();
  });
  sizeGroup.appendChild(sizeRange);
  body.appendChild(sizeGroup);

  // Margin
  const marginGroup = h('div', { class: 'field' });
  const marginLabel = h('label', { class: 'field-label' }, `Quiet zone — ${state.opts.margin}`);
  marginGroup.appendChild(marginLabel);
  const marginRange = h('input', { type: 'range', min: '0', max: '10', step: '1', value: String(state.opts.margin), class: 'range' }) as HTMLInputElement;
  marginRange.addEventListener('input', () => {
    state.opts.margin = Number(marginRange.value);
    marginLabel.textContent = `Quiet zone — ${state.opts.margin}`;
    saveOpts(state.opts);
    debouncedPreview();
  });
  marginGroup.appendChild(marginRange);
  body.appendChild(marginGroup);

  // Colours
  const colorRow = h('div', { class: 'color-row' });
  colorRow.appendChild(colorField('Foreground', state.opts.dark, (v) => { state.opts.dark = v; }));
  colorRow.appendChild(colorField('Background', state.opts.light, (v) => { state.opts.light = v; }));
  body.appendChild(colorRow);

  details.appendChild(body);
  return details;
}

function colorField(label: string, value: string, onChange: (v: string) => void): HTMLElement {
  const group = h('div', { class: 'field color-field' });
  group.appendChild(h('label', { class: 'field-label' }, label));
  const el = h('input', { type: 'color', value, class: 'color-input' }) as HTMLInputElement;
  el.addEventListener('input', () => {
    onChange(el.value);
    saveOpts(state.opts);
    debouncedPreview();
  });
  group.appendChild(el);
  return group;
}

function renderExportBar(): HTMLElement {
  const bar = h('div', { class: 'export-bar', id: 'export-bar' });
  const svgBtn = h('button', { type: 'button', class: 'btn', id: 'btn-svg' }, icon('download'), 'SVG');
  svgBtn.addEventListener('click', () => exportSvg());
  const pngBtn = h('button', { type: 'button', class: 'btn primary', id: 'btn-png' }, icon('download'), 'PNG');
  pngBtn.addEventListener('click', () => exportPng());
  const copyBtn = h('button', { type: 'button', class: 'btn', id: 'btn-copy' }, icon('copy'), 'Copy');
  copyBtn.addEventListener('click', () => copyPng());
  bar.appendChild(svgBtn);
  bar.appendChild(pngBtn);
  bar.appendChild(copyBtn);
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    const shareBtn = h('button', { type: 'button', class: 'btn', id: 'btn-share' }, icon('share'), 'Share');
    shareBtn.addEventListener('click', () => sharePng());
    bar.appendChild(shareBtn);
  }
  return bar;
}

let previewTimer: number | null = null;
function debouncedPreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = window.setTimeout(updatePreview, 200);
}

async function updatePreview(): Promise<void> {
  const placeholder = document.getElementById('preview-placeholder');
  const readout = document.getElementById('payload-readout');
  const bar = document.getElementById('export-bar');
  state.payload = computePayload();

  const hasData = state.payload.length > 0;
  if (bar) bar.classList.toggle('disabled', !hasData);
  if (readout) {
    readout.textContent = hasData ? state.payload : '';
    readout.style.display = hasData ? '' : 'none';
  }

  if (!previewCanvas) return;
  if (!hasData) {
    previewCanvas.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    return;
  }

  try {
    await toCanvas(previewCanvas, state.payload, state.opts);
    previewCanvas.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    setStatus('ready', `${state.type} code`);
  } catch (err) {
    previewCanvas.style.display = 'none';
    if (placeholder) {
      placeholder.style.display = '';
      placeholder.textContent =
        err instanceof QrTooLongError
          ? err.message
          : 'Could not render this code. Try different content.';
    }
    emit('encode', 'err', err instanceof Error ? err.message : 'render failed');
  }
}

// ---------- export actions ----------

function baseName(): string {
  return `qrforge-${state.type}`;
}

async function exportSvg(): Promise<void> {
  if (!state.payload) return;
  try {
    const svg = await toSvgString(state.payload, state.opts);
    downloadText(`${baseName()}.svg`, svg, 'image/svg+xml');
    toast('Downloaded SVG');
    emit('export', 'ok', 'downloaded svg');
  } catch (err) {
    toast(err instanceof Error ? err.message : 'SVG export failed');
  }
}

async function exportPng(): Promise<void> {
  if (!state.payload) return;
  try {
    const url = await toPngDataUrl(state.payload, state.opts);
    downloadDataUrl(`${baseName()}.png`, url);
    toast('Downloaded PNG');
    emit('export', 'ok', 'downloaded png');
  } catch (err) {
    toast(err instanceof Error ? err.message : 'PNG export failed');
  }
}

async function pngBlob(): Promise<Blob> {
  const url = await toPngDataUrl(state.payload, state.opts);
  const res = await fetch(url);
  return res.blob();
}

async function copyPng(): Promise<void> {
  if (!state.payload) return;
  try {
    if (!('clipboard' in navigator) || !('write' in navigator.clipboard) || typeof ClipboardItem === 'undefined') {
      throw new Error('unsupported');
    }
    const blob = await pngBlob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Copied PNG to clipboard');
    emit('export', 'ok', 'copied png');
  } catch {
    // Fall back to copying the payload text.
    try {
      await navigator.clipboard.writeText(state.payload);
      toast('Copied the code contents as text');
      emit('export', 'ok', 'copied text');
    } catch {
      toast('Copy is not available in this browser');
    }
  }
}

async function sharePng(): Promise<void> {
  if (!state.payload) return;
  try {
    const blob = await pngBlob();
    const file = new File([blob], `${baseName()}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'QR code' });
    } else {
      await navigator.share({ title: 'QR code', text: state.payload });
    }
    emit('export', 'ok', 'shared');
  } catch {
    /* cancelled */
  }
}

// ---------- scan view ----------

let videoEl: HTMLVideoElement | null = null;
let scanStream: MediaStream | null = null;
let scanRAF: number | null = null;
const scanCanvas: HTMLCanvasElement = document.createElement('canvas');

function renderScan(): HTMLElement {
  const wrap = h('div', { class: 'main-content scan-view' });

  const drop = h('div', { class: 'dropzone scan-drop', role: 'button', tabindex: '0', 'aria-label': 'Choose an image containing a QR code' });
  drop.appendChild(icon('image', 'dz-icon'));
  drop.appendChild(h('div', { class: 'dz-title' }, 'Drop an image with a QR code'));
  drop.appendChild(h('div', { class: 'dz-sub' }, 'or click to choose — PNG, JPG, WebP, GIF'));
  drop.appendChild(h('div', { class: 'dz-privacy' }, 'The image is decoded on your device and never uploaded.'));

  const fileInput = h('input', { type: 'file', accept: 'image/*', style: 'display:none' }) as HTMLInputElement;
  drop.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) scanImageFile(f);
  });
  drop.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragover');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) scanImageFile(f);
  });
  wrap.appendChild(drop);

  const camRow = h('div', { class: 'cam-row' });
  const camBtn = h('button', { type: 'button', class: 'btn ghost', id: 'cam-btn' }, icon('camera'), 'Scan with camera');
  camBtn.addEventListener('click', () => (state.cameraActive ? stopCamera() : startCamera()));
  camRow.appendChild(camBtn);
  wrap.appendChild(camRow);

  const camStage = h('div', { class: 'cam-stage', id: 'cam-stage', style: 'display:none' });
  wrap.appendChild(camStage);

  const result = h('div', { class: 'scan-result', id: 'scan-result' });
  wrap.appendChild(result);

  return wrap;
}

async function scanImageFile(file: File): Promise<void> {
  emit('scan', 'info', `scanning ${file.name}`, { via: engineName() });
  try {
    const bitmap = await createImageBitmap(file);
    scanCanvas.width = bitmap.width;
    scanCanvas.height = bitmap.height;
    const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const res = await detectFromCanvas(scanCanvas);
    if (res) {
      showScanResult(res.value, res.engine);
    } else {
      showScanEmpty();
    }
  } catch (err) {
    emit('scan', 'err', err instanceof Error ? err.message : 'scan failed');
    showScanError();
  }
}

async function startCamera(): Promise<void> {
  const stage = document.getElementById('cam-stage');
  const btn = document.getElementById('cam-btn');
  if (!stage) return;
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
  } catch {
    toast('Camera access was denied.');
    emit('scan', 'err', 'camera denied');
    return;
  }
  state.cameraActive = true;
  setStatus('busy', 'scanning');
  emit('scan', 'info', 'camera started', { via: engineName() });

  clear(stage);
  stage.style.display = '';
  videoEl = h('video', { class: 'cam-video', playsinline: 'true', muted: 'true' }) as HTMLVideoElement;
  videoEl.srcObject = scanStream;
  videoEl.setAttribute('playsinline', 'true');
  await videoEl.play().catch(() => undefined);
  stage.appendChild(videoEl);
  const overlay = h('div', { class: 'cam-reticle' });
  stage.appendChild(overlay);

  if (btn) {
    btn.classList.add('recording');
    clear(btn);
    btn.appendChild(icon('stop'));
    btn.appendChild(document.createTextNode('Stop camera'));
  }

  const tick = async () => {
    if (!state.cameraActive || !videoEl) return;
    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      scanCanvas.width = videoEl.videoWidth;
      scanCanvas.height = videoEl.videoHeight;
      const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0);
        try {
          const res = await detectFromCanvas(scanCanvas);
          if (res) {
            const engine = res.engine;
            stopCamera();
            showScanResult(res.value, engine);
            return;
          }
        } catch {
          /* keep scanning */
        }
      }
    }
    scanRAF = window.setTimeout(tick, 180);
  };
  tick();
}

function stopCamera(): void {
  state.cameraActive = false;
  if (scanRAF) {
    clearTimeout(scanRAF);
    scanRAF = null;
  }
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  const stage = document.getElementById('cam-stage');
  if (stage) {
    stage.style.display = 'none';
    clear(stage);
  }
  videoEl = null;
  const btn = document.getElementById('cam-btn');
  if (btn) {
    btn.classList.remove('recording');
    clear(btn);
    btn.appendChild(icon('camera'));
    btn.appendChild(document.createTextNode('Scan with camera'));
  }
  setStatus('ready', 'scan');
}

function showScanResult(value: string, engine: string): void {
  const host = document.getElementById('scan-result');
  if (!host) return;
  clear(host);
  const info = classifyScan(value);
  emit('scan', 'ok', `found ${info.kind}`, { via: engine });
  setStatus('ready', 'found a code');

  const card = h('div', { class: 'result-card' });
  const head = h('div', { class: 'result-head' });
  head.appendChild(icon('check', 'result-check'));
  head.appendChild(h('div', { class: 'result-kind' }, info.label));
  card.appendChild(head);

  const val = h('div', { class: 'result-value' });
  val.textContent = value;
  card.appendChild(val);

  const actions = h('div', { class: 'result-actions' });
  if (info.action) {
    // Render as a real anchor so the browser handles the (possibly external) scheme.
    const a = h('a', { class: 'btn primary', href: info.action.href, target: '_blank', rel: 'noopener noreferrer' }, info.action.label) as HTMLAnchorElement;
    actions.appendChild(a);
  }
  const copyBtn = h('button', { type: 'button', class: 'btn' }, icon('copy'), 'Copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast('Copied');
    } catch {
      toast('Copy failed');
    }
  });
  actions.appendChild(copyBtn);
  const againBtn = h('button', { type: 'button', class: 'btn ghost' }, 'Scan another');
  againBtn.addEventListener('click', () => {
    clear(host);
  });
  actions.appendChild(againBtn);
  card.appendChild(actions);

  host.appendChild(card);
}

function showScanEmpty(): void {
  const host = document.getElementById('scan-result');
  if (!host) return;
  clear(host);
  host.appendChild(
    h('div', { class: 'result-note' }, icon('warn', 'note-icon'), 'No QR code found in that image. Try a sharper or closer picture.'),
  );
  emit('scan', 'warn', 'no code found');
}

function showScanError(): void {
  const host = document.getElementById('scan-result');
  if (!host) return;
  clear(host);
  host.appendChild(h('div', { class: 'result-note' }, icon('warn', 'note-icon'), "Couldn't read that image file."));
}

// ---------- status ----------

function setStatus(kind: 'ready' | 'busy' | 'error', label: string): void {
  const dot = document.getElementById('sb-status-dot');
  const lbl = document.getElementById('sb-status-label');
  if (dot) dot.className = `dot-mini ${kind === 'error' ? 'err' : kind === 'busy' ? 'busy' : 'idle'}`;
  if (lbl) lbl.textContent = label;
  const mode = document.getElementById('sb-mode');
  if (mode) mode.textContent = state.mode;
}

// ---------- keyboard / paste ----------

function initShortcuts(): void {
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    if (state.mode === 'scan') {
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            scanImageFile(f);
            return;
          }
        }
      }
    }
  });
  window.addEventListener('beforeunload', () => stopCamera());
}

// ---------- boot ----------

function boot(): void {
  const drawer = document.getElementById('event-drawer');
  if (drawer) mountEventDrawer(drawer);
  initModalTriggers();
  initGlossary();
  initShortcuts();

  const banner = document.getElementById('trust-banner');
  if (banner) {
    const open = () => {
      const tmpl = document.getElementById('tmpl-security') as HTMLTemplateElement | null;
      if (tmpl) openModal(tmpl.content.cloneNode(true) as DocumentFragment);
    };
    banner.addEventListener('click', open);
    banner.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }

  const engineEl = document.getElementById('sb-engine');
  if (engineEl) engineEl.textContent = engineName();

  emit('system', 'ok', 'qrforge ready — nothing is uploaded');
  setStatus('ready', 'generate');
  render();
  registerServiceWorker();
}

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

boot();
