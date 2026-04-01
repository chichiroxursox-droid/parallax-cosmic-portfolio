import { gsap } from 'gsap';
import { sphere, ring, ring2, stars, starMat } from './sections/hero.js';

/**
 * runIntro()
 * Orchestrates the full loading + entrance sequence.
 * Returns a Promise that resolves when the sequence is complete.
 *
 * Sequence:
 *  0. Overlay is visible from HTML, progress bar fills while WebGL + fonts load
 *  1. Progress bar dissolves
 *  2. "PARALLAX" title wipes in via clip-path (left → right)
 *  3. Sphere scales 0 → 1 with elastic.out
 *  4. Orbital rings sweep in with staggered rotation
 *  5. Tagline fades in
 *  6. Star field fades up
 *  7. Scroll indicator fades in, overlay removed
 */
export function runIntro() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('loader-overlay');
    const fill    = document.querySelector('.loader-bar-fill');

    // ── 1. Ensure hero elements start invisible ──────────────────────────────
    // (hero.js sets scale/opacity to 0, but we also hide the DOM elements)
    gsap.set('.hero-title',    { clipPath: 'inset(0 100% 0 0)', opacity: 1 });
    gsap.set('.hero-tagline',  { opacity: 0 });
    gsap.set('.hero-hint',     { opacity: 0 });
    gsap.set('.scroll-indicator', { opacity: 0 });

    // ── 2. Wait for fonts + a minimum delay so WebGL context is ready ─────────
    const minDelay = new Promise((r) => setTimeout(r, 600));

    Promise.all([document.fonts.ready, minDelay]).then(() => {

      // ── 3. Fill progress bar → 100% ───────────────────────────────────────
      gsap.to(fill, {
        width: '100%',
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {

          // ── 4. Build the main intro timeline ─────────────────────────────
          const tl = gsap.timeline({ onComplete: resolve });

          // Step 1: Progress bar dissolves (fade + tiny scale-down)
          tl.to('.loader-bar-track', {
            opacity: 0,
            scaleX: 0.6,
            duration: 0.35,
            ease: 'power2.in',
          });

          // Step 2: Overlay fades out (reveals the canvas + hero underneath)
          tl.to(overlay, {
            opacity: 0,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => overlay.remove(),
          }, '-=0.1');

          // Step 3: Title clip-path wipe left → right (0.8s)
          tl.to('.hero-title', {
            clipPath: 'inset(0 0% 0 0)',
            duration: 0.8,
            ease: 'power3.out',
          }, '-=0.15');

          // Step 4: Sphere scales 0 → 1 with elastic.out (1.2s, starts 0.3s after title)
          tl.to(sphere.scale, {
            x: 1, y: 1, z: 1,
            duration: 1.2,
            ease: 'elastic.out(1, 0.5)',
          }, '-=0.5');

          // Step 5a: Ring 1 sweeps in — animate rotation from offset position
          tl.fromTo(ring.rotation,
            { z: ring.rotation.z - Math.PI },
            { z: ring.rotation.z, duration: 0.6, ease: 'power2.out' },
            '<0.0'
          );

          // Step 5b: Ring 2 sweeps in — staggered 0.2s after ring 1
          tl.fromTo(ring2.rotation,
            { y: ring2.rotation.y - Math.PI },
            { y: ring2.rotation.y, duration: 0.6, ease: 'power2.out' },
            '<0.2'
          );

          // Step 6: Star field fades up (runs during steps 3-5, 0 → 0.8)
          tl.to(starMat.uniforms.uOpacity, {
            value: 0.8,
            duration: 1.4,
            ease: 'power1.inOut',
          }, '<-1.0');

          // Step 7: Tagline fades in
          tl.to('.hero-tagline', {
            opacity: 1,
            duration: 1.0,
            ease: 'power2.out',
          }, '-=0.4');

          // Step 8: Drag hint fades in, then hands off to CSS pulse animation
          tl.to('.hero-hint', {
            opacity: 0.5,
            duration: 0.8,
            ease: 'power2.out',
            onComplete: () => {
              // Clear inline opacity so the CSS pulse animation can take over
              const hint = document.querySelector('.hero-hint');
              if (hint) hint.style.opacity = '';
            },
          }, '-=0.2');

          // Step 9: Scroll indicator appears at the very end
          tl.to('.scroll-indicator', {
            opacity: 0.6,
            duration: 0.8,
            ease: 'power2.out',
          }, '-=0.5');
        },
      });
    });
  });
}
