import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import renderer from '../renderer.js';

gsap.registerPlugin(ScrollTrigger);

// Scene + Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// ── Stars ──
const starCount = 3000;
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
const targetPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
  // Origin: sphere distribution (hero state)
  const r = 50 + Math.random() * 200;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
  starSizes[i] = 0.1 + Math.random() * 0.4;

  // Target: wider scatter biased to edges (about-section ambient state)
  const tr = 100 + Math.random() * 300;
  const tTheta = Math.random() * Math.PI * 2;
  const tPhi = Math.acos(2 * Math.random() - 1);
  targetPositions[i * 3]     = tr * Math.sin(tPhi) * Math.cos(tTheta) * 1.5;
  targetPositions[i * 3 + 1] = tr * Math.sin(tPhi) * Math.sin(tTheta) * 1.5;
  targetPositions[i * 3 + 2] = tr * Math.cos(tPhi);
}

starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeo.setAttribute('aSize',    new THREE.BufferAttribute(starSizes, 1));
starGeo.setAttribute('aTarget',  new THREE.BufferAttribute(targetPositions, 3));

const starMat = new THREE.ShaderMaterial({
  uniforms: {
    uProgress:   { value: 0.0 },
    uSize:       { value: 0.3 },
    uColor:      { value: new THREE.Color(0xe8eaf0) },
    uOpacity:    { value: 0.0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  },
  vertexShader: `
    attribute vec3 aTarget;
    attribute float aSize;
    uniform float uProgress;
    uniform float uSize;
    uniform float uPixelRatio;

    void main() {
      vec3 pos = mix(position, aTarget, uProgress);
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * uSize * uPixelRatio * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d) * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
});

const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ── Central Sphere with custom iridescent shader ──
const sphereGeo = new THREE.IcosahedronGeometry(1.2, 64);

const sphereMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0x7c3aed) },  // violet
    uColor2: { value: new THREE.Color(0x00f5ff) },  // cyan
    uColor3: { value: new THREE.Color(0xff6b35) },  // flare (subtle accent)
    uFresnelPower: { value: 2.5 },
    uDisplacementScale: { value: 0.12 },
    uHover: { value: 0 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uDisplacementScale;
    uniform float uHover;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;

    // Simplex-like noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec3 pos = position;

      // Multi-layered noise displacement
      float noise1 = snoise(pos * 1.5 + uTime * 0.3) * 0.5;
      float noise2 = snoise(pos * 3.0 - uTime * 0.5) * 0.25;
      float noise3 = snoise(pos * 6.0 + uTime * 0.8) * 0.125;
      float displacement = (noise1 + noise2 + noise3) * (uDisplacementScale + uHover * 0.06);

      pos += normal * displacement;
      vDisplacement = displacement;
      vPosition = pos;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uFresnelPower;
    uniform float uHover;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;

    void main() {
      // Fresnel rim lighting
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), uFresnelPower);

      // Iridescent color shifting based on view angle + time
      float angle = dot(viewDir, vNormal);
      float shift = angle * 2.0 + uTime * 0.15;

      vec3 color = mix(uColor1, uColor2, sin(shift) * 0.5 + 0.5);
      color = mix(color, uColor3, sin(shift * 1.7 + 1.5) * 0.15 + 0.15);

      // Add displacement coloring — peaks glow cyan
      color += uColor2 * smoothstep(0.0, 0.1, vDisplacement) * 0.4;

      // Fresnel rim glow
      color += uColor2 * fresnel * (0.8 + uHover * 0.4);

      // Core brightness
      float core = smoothstep(0.8, 0.0, fresnel) * 0.15;
      color += vec3(core);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.scale.set(0, 0, 0); // hidden until loader intro reveals it
scene.add(sphere);

// Outer glow ring (subtle orbit ring to hint at interactivity)
const ringGeo = new THREE.TorusGeometry(1.7, 0.008, 8, 128);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.25 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI * 0.35;
scene.add(ring);

// Second ring at different angle
const ring2 = new THREE.Mesh(
  new THREE.TorusGeometry(1.9, 0.005, 8, 128),
  new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.15 })
);
ring2.rotation.x = Math.PI * 0.6;
ring2.rotation.z = Math.PI * 0.3;
scene.add(ring2);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0x00f5ff, 2, 20);
pointLight.position.set(3, 2, 4);
scene.add(pointLight);
const pointLight2 = new THREE.PointLight(0x7c3aed, 1.5, 15);
pointLight2.position.set(-3, -1, 2);
scene.add(pointLight2);
const pointLight3 = new THREE.PointLight(0xff6b35, 0.5, 12);
pointLight3.position.set(0, -3, 3);
scene.add(pointLight3);

// ── Mouse Parallax ──
const mouse = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ── Drag to Rotate ──
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
const sphereRotation = { x: 0, y: 0 };
let hasInteracted = false;
let isHovering = false;

const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (e) => {
  mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const hits = raycaster.intersectObject(sphere);
  if (hits.length > 0) {
    isDragging = true;
    prevMouse.x = e.clientX;
    prevMouse.y = e.clientY;
    if (!hasInteracted) {
      hasInteracted = true;
      const hint = document.querySelector('.hero-hint');
      if (hint) gsap.to(hint, { opacity: 0, duration: 0.5 });
    }
  }
});

window.addEventListener('pointermove', (e) => {
  if (isDragging) {
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    sphereRotation.y += dx * 0.005;
    sphereRotation.x += dy * 0.005;
    prevMouse.x = e.clientX;
    prevMouse.y = e.clientY;
  }

  // Hover detection for sphere glow
  mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNdc, camera);
  const hits = raycaster.intersectObject(sphere);
  const wasHovering = isHovering;
  isHovering = hits.length > 0;

  if (isHovering && !wasHovering) {
    renderer.domElement.style.cursor = 'grab';
    gsap.to(sphereMat.uniforms.uHover, { value: 1, duration: 0.4, ease: 'power2.out' });
  } else if (!isHovering && wasHovering && !isDragging) {
    renderer.domElement.style.cursor = '';
    gsap.to(sphereMat.uniforms.uHover, { value: 0, duration: 0.6, ease: 'power2.out' });
  }
});

window.addEventListener('pointerup', () => {
  isDragging = false;
  if (!isHovering) {
    renderer.domElement.style.cursor = '';
    gsap.to(sphereMat.uniforms.uHover, { value: 0, duration: 0.6 });
  }
});

// ── Resize ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Visibility flag (stops rendering when scrolled past hero) ──
let heroVisible = true;

// ── Animate ──
const clock = new THREE.Clock();

function animate() {
  if (!heroVisible) return;

  const elapsed = clock.getElapsedTime();

  // Update shader time
  sphereMat.uniforms.uTime.value = elapsed;

  // Subtle camera parallax from mouse
  camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.05;
  camera.position.y += (-mouse.y * 0.3 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  // Sphere rotation (drag + idle drift)
  sphere.rotation.x = sphereRotation.x + elapsed * 0.05;
  sphere.rotation.y = sphereRotation.y + elapsed * 0.08;

  // Animate orbital rings
  ring.rotation.z = elapsed * 0.15;
  ring2.rotation.y = elapsed * 0.1;

  // Pulse ring opacity subtly
  ringMat.opacity = 0.2 + Math.sin(elapsed * 0.8) * 0.1;

  // Slow star field rotation
  stars.rotation.y = elapsed * 0.005;
}

// ── Scroll-driven fade-out ──
function initHeroScroll() {
  gsap.to('.hero-content', {
    opacity: 0,
    y: -50,
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: '80% top',
      scrub: true,
    },
  });

  gsap.to('.scroll-indicator', {
    opacity: 0,
    scrollTrigger: {
      trigger: '#hero',
      start: '20% top',
      end: '40% top',
      scrub: true,
    },
  });

  // Star field morphs from sphere cluster → dispersed ambient field as user scrolls into About
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'bottom bottom',
    endTrigger: '#about',
    end: 'top top',
    scrub: 1,
    onUpdate: (self) => {
      starMat.uniforms.uProgress.value = self.progress;
    },
  });

  // Hide hero 3D scene once user scrolls into About section
  ScrollTrigger.create({
    trigger: '#about',
    start: 'top bottom',
    onEnter: () => { heroVisible = false; },
    onLeaveBack: () => { heroVisible = true; },
  });
}

export { scene, camera, animate, initHeroScroll, heroVisible, sphere, ring, ring2, stars, starMat };
