/**
 * scroll-nav.js
 * Fixed dot navigation on the right edge of the viewport.
 * 6 dots representing each section; active dot glows in --cyan.
 */

const SECTIONS = [
  { id: 'hero',     label: 'Hero'     },
  { id: 'about',    label: 'About'    },
  { id: 'work',     label: 'Work'     },
  { id: 'zoom',     label: 'Zoom'     },
  { id: 'services', label: 'Services' },
  { id: 'contact',  label: 'Contact'  },
];

/**
 * Build the nav DOM, wire up IntersectionObserver, and attach click handlers.
 * @param {import('@studio-freight/lenis').default} lenis
 */
export function initScrollNav(lenis) {
  // ── Create nav container ──────────────────────────────────────────────────
  const nav = document.createElement('nav');
  nav.className = 'scroll-nav';
  nav.setAttribute('aria-label', 'Section navigation');

  const dots = [];

  SECTIONS.forEach(({ id, label }) => {
    const dot = document.createElement('div');
    dot.className = 'scroll-nav-dot';
    dot.setAttribute('data-section', id);
    dot.setAttribute('role', 'button');
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('aria-label', `Scroll to ${label}`);

    const labelEl = document.createElement('span');
    labelEl.className = 'scroll-nav-label';
    labelEl.textContent = label;

    dot.appendChild(labelEl);
    nav.appendChild(dot);
    dots.push(dot);

    // Click handler
    dot.addEventListener('click', () => {
      lenis.scrollTo(`#${id}`, { duration: 1.4 });
    });

    // Keyboard handler (Enter / Space)
    dot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        lenis.scrollTo(`#${id}`, { duration: 1.4 });
      }
    });
  });

  document.body.appendChild(nav);

  // ── Activate first dot by default ─────────────────────────────────────────
  if (dots[0]) dots[0].classList.add('active');

  // ── IntersectionObserver — mark which section is in view ─────────────────
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const sectionId = entry.target.id;
        dots.forEach((dot) => {
          const isActive = dot.getAttribute('data-section') === sectionId;
          dot.classList.toggle('active', isActive);
        });
      });
    },
    {
      // Trigger when the section covers at least 40% of the viewport
      threshold: 0.4,
    }
  );

  SECTIONS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}
