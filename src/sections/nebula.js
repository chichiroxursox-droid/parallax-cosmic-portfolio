import * as THREE from 'three';

// ── Orthographic scene — always full-screen ──
export const nebulaScene = new THREE.Scene();
export const nebulaCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ── Uniforms ──
const nebulaUniforms = {
  uTime:    { value: 0.0 },
  uScrollY: { value: 0.0 },
  uOpacity: { value: 1.0 },
  uRes:     { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};

// ── Shader material ──
const nebulaMat = new THREE.ShaderMaterial({
  uniforms: nebulaUniforms,
  depthWrite: false,
  depthTest: false,
  transparent: true,

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform float uTime;
    uniform float uScrollY;  // 0.0 → 1.0 normalised scroll progress
    uniform float uOpacity;
    varying vec2 vUv;

    // ── Hash / noise ──
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 7; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    // Domain warping for organic cloud shapes
    float warpedFbm(vec2 p, float t) {
      vec2 q = vec2(
        fbm(p + vec2(0.0, 0.0)),
        fbm(p + vec2(5.2, 1.3))
      );
      vec2 r = vec2(
        fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15  * t),
        fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t)
      );
      return fbm(p + 4.0 * r);
    }

    // ── Section colour palettes ──
    // Returns (colorA, colorB) — two cloud tones blended by cloud density.
    // pairIdx selects which palette block runs; we use smooth ramps between them.

    vec3 sectionColorA(float s) {
      // s = uScrollY 0→1
      // Hero     0.00-0.12  : deep violet
      vec3 hero    = vec3(0.18, 0.05, 0.42);
      // About    0.12-0.30  : navy
      vec3 about   = vec3(0.04, 0.06, 0.22);
      // Work     0.30-0.55  : blue-violet
      vec3 work    = vec3(0.10, 0.08, 0.38);
      // Zoom     0.55-0.72  : warm orange
      vec3 zoom    = vec3(0.38, 0.14, 0.04);
      // Services 0.72-0.88  : amber-gold
      vec3 srv     = vec3(0.42, 0.28, 0.02);
      // Contact  0.88-1.00  : very dark, near-black
      vec3 contact = vec3(0.02, 0.03, 0.08);

      // Piecewise smooth blend
      vec3 col = hero;
      col = mix(col, about,   smoothstep(0.10, 0.16, s));
      col = mix(col, work,    smoothstep(0.26, 0.34, s));
      col = mix(col, zoom,    smoothstep(0.52, 0.60, s));
      col = mix(col, srv,     smoothstep(0.69, 0.76, s));
      col = mix(col, contact, smoothstep(0.85, 0.92, s));
      return col;
    }

    vec3 sectionColorB(float s) {
      // Brighter wisp tone — complements colorA
      // Hero     : cyan wisps
      vec3 hero    = vec3(0.00, 0.78, 0.90);
      // About    : subtle blue
      vec3 about   = vec3(0.10, 0.18, 0.55);
      // Work     : electric violet
      vec3 work    = vec3(0.36, 0.12, 0.90);
      // Zoom     : soft orange-gold
      vec3 zoom    = vec3(0.90, 0.45, 0.10);
      // Services : amber highlight
      vec3 srv     = vec3(0.95, 0.72, 0.10);
      // Contact  : cyan sparks (sparse but present)
      vec3 contact = vec3(0.00, 0.72, 0.82);

      vec3 col = hero;
      col = mix(col, about,   smoothstep(0.10, 0.16, s));
      col = mix(col, work,    smoothstep(0.26, 0.34, s));
      col = mix(col, zoom,    smoothstep(0.52, 0.60, s));
      col = mix(col, srv,     smoothstep(0.69, 0.76, s));
      col = mix(col, contact, smoothstep(0.85, 0.92, s));
      return col;
    }

    // Cloud density modifier per section — dims clouds during About / Contact
    float sectionDensity(float s) {
      float d = 0.5;                                   // Hero   : subtle backdrop
      d = mix(d, 0.35, smoothstep(0.10, 0.16, s));  // About  : pull back
      d = mix(d, 0.75, smoothstep(0.26, 0.34, s));  // Work   : restore
      d = mix(d, 0.85, smoothstep(0.52, 0.60, s));  // Zoom
      d = mix(d, 0.90, smoothstep(0.69, 0.76, s));  // Services
      d = mix(d, 0.30, smoothstep(0.85, 0.92, s));  // Contact : sparse
      return d;
    }

    void main() {
      // Drift the UV plane slowly over time
      vec2 uv = vUv;
      uv.x += uTime * 0.012;
      uv.y += uTime * 0.007;

      // Scale up so the pattern covers the viewport well
      uv *= 2.2;

      // Main cloud density via domain-warped FBM
      float cloud = warpedFbm(uv, uTime * 0.05);

      // Remap: push below-average values toward 0 for a "sparse cloud" feel
      cloud = smoothstep(0.35, 0.75, cloud);

      // Section colour look-up
      float s        = clamp(uScrollY, 0.0, 1.0);
      vec3  colorA   = sectionColorA(s);
      vec3  colorB   = sectionColorB(s);
      float density  = sectionDensity(s);

      // Blend the two colours by cloud brightness
      vec3 color = mix(colorA, colorB, cloud * 0.7);

      // Apply section density — thins the clouds per section
      float alpha = cloud * density * uOpacity;

      // Keep the final alpha gentle so the nebula never overwhelms foreground
      alpha = clamp(alpha * 0.5, 0.0, 0.45);

      gl_FragColor = vec4(color, alpha);
    }
  `,
});

// ── Full-screen quad ──
// PlaneGeometry at NDC coords — the vert shader ignores projection so it
// always fills exactly the viewport regardless of camera or window size.
const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  nebulaMat
);
nebulaScene.add(quad);

// ── Resize — keep resolution uniform current (not strictly needed for this
// shader but useful if you add any screen-space effects later) ──
window.addEventListener('resize', () => {
  nebulaUniforms.uRes.value.set(window.innerWidth, window.innerHeight);
});

/**
 * Call once per frame from the main tick loop.
 *
 * @param {number} elapsed - Total elapsed time in seconds (THREE.Clock.getElapsedTime())
 */
export function updateNebula(elapsed) {
  nebulaUniforms.uTime.value = elapsed;

  const scrollMax = document.body.scrollHeight - window.innerHeight;
  nebulaUniforms.uScrollY.value =
    scrollMax > 0 ? window.scrollY / scrollMax : 0.0;
}
