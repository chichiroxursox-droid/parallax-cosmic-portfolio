import * as THREE from 'three';
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './style/base.css';
import './style/sections.css';

import { setScene, renderComposed, updateChromaticAberration } from './postprocessing.js';
import { updateNebula } from './sections/nebula.js';
import { animate as heroAnimate, initHeroScroll, scene as heroScene, camera as heroCamera, heroVisible } from './sections/hero.js';
import { runIntro } from './loader.js';
import { initAbout } from './sections/about.js';
import { initWork } from './sections/work.js';
import { animate as zoomAnimate, initZoom, scene as zoomScene, camera as zoomCamera, zoomActive } from './sections/zoom.js';
import { animate as servicesAnimate, initServices, scene as servicesScene, camera as servicesCamera, servicesVisible } from './sections/services.js';
import { animate as contactAnimate, initContact, scene as contactScene, camera as contactCamera, contactVisible } from './sections/contact.js';
import { initScrollNav } from './scroll-nav.js';
import { initCursor } from './cursor.js';

gsap.registerPlugin(ScrollTrigger);

// ── Lenis ──
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ── Init Sections ──
initHeroScroll();
initAbout();
initWork();
initZoom();
initServices();
initContact();

// ── Clock for deltaTime ──
const clock = new THREE.Clock();

// ── Render Loop ──
function tick() {
  const delta   = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Nebula runs every frame regardless of which section is active
  updateNebula(elapsed);

  // Update section state (animations, uniforms, camera movement — no rendering)
  heroAnimate();
  zoomAnimate();
  servicesAnimate();
  contactAnimate();

  // Determine active scene — priority: contact > zoom > hero (fallback).
  // When no section 3D scene is active (About / Work / Services), we still
  // render the nebula alone so it stays visible as a persistent background.
  if (contactVisible) {
    setScene(contactScene, contactCamera);
  } else if (servicesVisible) {
    setScene(servicesScene, servicesCamera);
  } else if (zoomActive) {
    setScene(zoomScene, zoomCamera);
  } else if (heroVisible) {
    setScene(heroScene, heroCamera);
  }
  // No else-return: nebula pass always runs via renderComposed regardless.

  updateChromaticAberration(lenis.velocity);
  renderComposed(delta);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ── Scroll dot navigation ──
initScrollNav(lenis);

// ── Custom cursor ──
initCursor();

// ── Loading + hero intro sequence ──
// Render loop starts immediately so nebula animates during loading.
runIntro();
