/**
 * Glossary — click-to-define tooltips for QR jargon.
 */

export const GLOSSARY: Record<string, string> = {
  ecc: 'Error correction adds redundancy so a code still scans when it is partly dirty, damaged, or has a logo over the middle. Levels L, M, Q, H recover roughly 7%, 15%, 25% and 30% of the code.',
  'quiet-zone':
    'The blank margin around a QR code. Scanners need it to find the code — too little and the code may not read.',
  redirect:
    'Many "free" QR generators encode a link to their own server, which then forwards to your real destination. That lets them count every scan and disable the code later. QRForge never does this — your data is inside the code itself.',
  barcodedetector:
    'A built-in browser API that reads barcodes and QR codes from images and video — on your device, with no network call.',
  vcard: 'A standard contact-card format. A QR containing a vCard lets a phone add the contact in one tap.',
  svg: 'A vector image format that stays razor-sharp at any size — ideal for printing a QR large on a poster.',
};

let tooltipEl: HTMLElement | null = null;

function ensureTooltip(): HTMLElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'glossary-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function hideTooltip(): void {
  if (tooltipEl) tooltipEl.classList.remove('visible');
}

function showTooltip(anchor: HTMLElement, term: string): void {
  const def = GLOSSARY[term];
  if (!def) return;
  const tip = ensureTooltip();
  tip.textContent = def;
  tip.classList.add('visible');

  const r = anchor.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = r.left + r.width / 2 - tipRect.width / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - tipRect.width - 12));
  let top = r.bottom + 8;
  if (top + tipRect.height > window.innerHeight - 12) top = r.top - tipRect.height - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

/** Delegate clicks on any `.glossary-link` to toggle its definition tooltip. */
export function initGlossary(): void {
  let openAnchor: HTMLElement | null = null;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest<HTMLElement>('.glossary-link');
    if (link) {
      e.preventDefault();
      const term = link.dataset.term;
      if (!term) return;
      if (openAnchor === link) {
        hideTooltip();
        openAnchor = null;
      } else {
        showTooltip(link, term);
        openAnchor = link;
      }
      return;
    }
    if (!target.closest('.glossary-tooltip')) {
      hideTooltip();
      openAnchor = null;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
      openAnchor = null;
    }
  });

  window.addEventListener('scroll', () => {
    hideTooltip();
    openAnchor = null;
  }, true);
}
