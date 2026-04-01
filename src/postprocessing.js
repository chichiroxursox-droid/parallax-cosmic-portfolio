import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
  NoiseEffect,
  BlendFunction,
} from 'postprocessing';
import renderer from './renderer.js';
import { nebulaScene, nebulaCamera } from './sections/nebula.js';

// ── Nebula background pass (rendered first, clears the buffer) ──
const nebulaPass = new RenderPass(nebulaScene, nebulaCamera);
// nebulaPass.clear = true is the default — it clears to the void colour
// before painting the nebula, which is what we want.

// ── Active section pass (layered on top, no clear) ──
// Placeholder scene and camera — updated via setScene() before first render
const _scene = new THREE.Scene();
const _camera = new THREE.PerspectiveCamera();

const renderPass = new RenderPass(_scene, _camera);
// Do NOT clear: the nebula has already been drawn to the buffer.
renderPass.clear = false;

// BloomEffect — mipmap-based bloom at 0.5x resolution for performance
const bloomEffect = new BloomEffect({
  luminanceThreshold: 0.85,
  luminanceSmoothing: 0.03,
  mipmapBlur: true,
  intensity: 0.6,
  radius: 0.4,
  resolutionScale: 0.5, // render bloom at half resolution
});

// ChromaticAberrationEffect — RGB channel offset driven by scroll velocity
const chromaticEffect = new ChromaticAberrationEffect({
  offset: new THREE.Vector2(0, 0), // starts at zero, animated in updateChromaticAberration()
  radialModulation: false,
  modulationOffset: 0.0,
});

// NoiseEffect — replaces the CSS body::after film grain overlay
const noiseEffect = new NoiseEffect({
  blendFunction: BlendFunction.OVERLAY,
  premultiply: true,
});
noiseEffect.blendMode.opacity.value = 0.04;

const effectPass = new EffectPass(_camera, bloomEffect, chromaticEffect, noiseEffect);

// EffectComposer wraps the shared renderer
const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType, // better precision for bloom
});

composer.addPass(nebulaPass);   // 1st: draw nebula background
composer.addPass(renderPass);   // 2nd: draw active section on top (no clear)
composer.addPass(effectPass);   // 3rd: bloom + any other effects

// Keep composer in sync with the viewport
window.addEventListener('resize', () => {
  composer.setSize(window.innerWidth, window.innerHeight);
});

/**
 * Update the RenderPass to use a new scene and camera.
 * Call this once per frame (or when the active section changes) before
 * calling renderComposed().
 *
 * @param {THREE.Scene}  scene
 * @param {THREE.Camera} camera
 */
export function setScene(scene, camera) {
  renderPass.mainScene = scene;
  renderPass.mainCamera = camera;
  // EffectPass needs the camera reference too so uniforms (e.g. depth) stay correct
  effectPass.mainCamera = camera;
}

/**
 * Drive chromatic aberration offset from Lenis scroll velocity.
 * Call once per tick before renderComposed().
 *
 * @param {number} velocity - Current lenis.velocity value
 */
export function updateChromaticAberration(velocity) {
  const absVel = Math.abs(velocity);
  if (absVel > 3.0) {
    // Map velocity 3→8 onto strength 0→1, then scale to max 0.003 offset
    const strength = Math.min((absVel - 3.0) / 5.0, 1.0);
    const offset = strength * 0.003;
    chromaticEffect.offset.set(offset, offset * 0.5); // slight Y asymmetry for organic feel
  } else {
    // Lerp back to zero for smooth deactivation
    chromaticEffect.offset.x *= 0.9;
    chromaticEffect.offset.y *= 0.9;
  }
}

/**
 * Render one frame through the full post-processing pipeline.
 *
 * @param {number} deltaTime - Elapsed time in seconds since the last frame.
 */
export function renderComposed(deltaTime) {
  composer.render(deltaTime);
}

export default composer;
