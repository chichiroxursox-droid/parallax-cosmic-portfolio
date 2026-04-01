// ── Custom cursor — small lerp-following circle ───────────────────────────

const CURSOR_SIZE_DEFAULT  = 12;
const CURSOR_SIZE_EXPANDED = 40;
const LERP_FACTOR          = 0.15;
const COLOR_DEFAULT        = '#00f5ff'; // --cyan

let cursor     = null;
let mouse      = { x: -200, y: -200 };
let current    = { x: -200, y: -200 };
let isExpanded = false;
let expandColor = COLOR_DEFAULT;
let isHidden   = false;
let rafId      = null;

// ── Build DOM element ──────────────────────────────────────────────────────
function createCursorEl() {
  const el = document.createElement('div');
  el.id = 'custom-cursor';
  Object.assign(el.style, {
    position:     'fixed',
    top:          '0',
    left:         '0',
    width:        `${CURSOR_SIZE_DEFAULT}px`,
    height:       `${CURSOR_SIZE_DEFAULT}px`,
    borderRadius: '50%',
    border:       `2px solid ${COLOR_DEFAULT}`,
    background:   'transparent',
    pointerEvents:'none',
    zIndex:       '9999',
    transform:    'translate(-50%, -50%)',
    transition:   'width 0.2s ease, height 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
    willChange:   'transform',
    opacity:      '0',             // invisible until first mouse move
  });
  document.body.appendChild(el);
  return el;
}

// ── Lerp helper ────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ── Animation loop ─────────────────────────────────────────────────────────
function loop() {
  current.x = lerp(current.x, mouse.x, LERP_FACTOR);
  current.y = lerp(current.y, mouse.y, LERP_FACTOR);

  cursor.style.transform = `translate(calc(-50% + ${current.x}px), calc(-50% + ${current.y}px))`;

  rafId = requestAnimationFrame(loop);
}

// ── Expand / collapse ──────────────────────────────────────────────────────
function expand(color) {
  isExpanded = true;
  expandColor = color || COLOR_DEFAULT;
  cursor.style.width        = `${CURSOR_SIZE_EXPANDED}px`;
  cursor.style.height       = `${CURSOR_SIZE_EXPANDED}px`;
  cursor.style.borderColor  = expandColor;
}

function collapse() {
  isExpanded = false;
  cursor.style.width        = `${CURSOR_SIZE_DEFAULT}px`;
  cursor.style.height       = `${CURSOR_SIZE_DEFAULT}px`;
  cursor.style.borderColor  = COLOR_DEFAULT;
}

// ── Hide / show (for WebGL drag state) ────────────────────────────────────
export function hideCursor() {
  if (!cursor) return;
  cursor.style.opacity = '0';
  isHidden = true;
}

export function showCursor() {
  if (!cursor) return;
  cursor.style.opacity = '1';
  isHidden = false;
}

// ── Attach interactive element listeners ──────────────────────────────────
function bindInteractiveElements() {
  const selector = 'a, button, .work-card';

  // Use event delegation so dynamically added elements are also caught.
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest(selector);
    if (!target) return;

    // Try to read an accent color from the element's CSS custom property.
    const accentColor = getComputedStyle(target).getPropertyValue('--accent').trim() || null;
    expand(accentColor);
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest(selector);
    if (!target) return;

    // Only collapse if we're not moving into a child of the same interactive el.
    const related = e.relatedTarget;
    if (related && target.contains(related)) return;

    collapse();
  });
}

// ── Public init ───────────────────────────────────────────────────────────
export function initCursor() {
  // Hide on touch devices.
  const isTouch = 'ontouchstart' in window || !window.matchMedia('(hover: hover)').matches;
  if (isTouch) return;

  cursor = createCursorEl();

  // Track raw mouse position.
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (cursor.style.opacity === '0' && !isHidden) {
      cursor.style.opacity = '1';
    }
  });

  bindInteractiveElements();

  // Start raf loop.
  loop();
}
