import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Scene ──
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0, 15);

// Ambient light
scene.add(new THREE.AmbientLight(0xffffff, 0.2));

// ── Asteroids ──
const asteroidGeo = new THREE.DodecahedronGeometry(0.4, 0);
const asteroidMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8 });

for (let i = 0; i < 40; i++) {
  const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
  asteroid.position.set(
    (Math.random() - 0.5) * 60,
    (Math.random() - 0.5) * 40,
    (Math.random() - 0.5) * 60
  );
  asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  const s = 0.5 + Math.random() * 1.5;
  asteroid.scale.setScalar(s);
  scene.add(asteroid);
}

// ── Contact Data ──
// End positions: 5 nodes evenly spaced in a radial ring, radius 4.5, at z=0
const RADIUS = 4.5;
const contactData = [
  { label: 'Email (click to copy)', url: '#', email: 'hello@example.com' },
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'LinkedIn', url: 'https://linkedin.com' },
  { label: 'Twitter / X', url: 'https://x.com' },
  { label: "Let's build →", url: 'mailto:hello@example.com' },
];

// Compute evenly-distributed radial end positions
const endPositions = contactData.map((_, i) => {
  const angle = (i / contactData.length) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(
    Math.cos(angle) * RADIUS,
    Math.sin(angle) * RADIUS,
    0
  );
});

// Scattered start positions (off-screen / far out)
const startPositions = [
  new THREE.Vector3(-22, 14, -10),
  new THREE.Vector3(25, -8, -12),
  new THREE.Vector3(-18, -16, -8),
  new THREE.Vector3(20, 18, -15),
  new THREE.Vector3(8, -20, -6),
];

// ── Build Node Group ──
const nodes = [];
const nodeGroup = new THREE.Group();

// Trailing lines — one per node, from node back to center (0,0,0)
const lineObjects = [];

contactData.forEach((data, i) => {
  // Sphere
  const geo = new THREE.SphereGeometry(0.25, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(startPositions[i]);
  nodeGroup.add(mesh);

  // Point light
  const light = new THREE.PointLight(0x00f5ff, 0, 8);
  light.position.copy(mesh.position);
  nodeGroup.add(light);

  // Trailing line: two vertices — node position and origin
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(6); // 2 points * 3 floats
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeo.setDrawRange(0, 0); // start invisible
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.3 });
  const line = new THREE.Line(lineGeo, lineMat);
  nodeGroup.add(line);

  nodes.push({ mesh, light, data, line, lineGeo });
  lineObjects.push(line);
});

scene.add(nodeGroup);

// ── CSS Labels ──
const labelContainer = document.createElement('div');
labelContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;';
document.body.appendChild(labelContainer);

const labelEls = contactData.map((data, i) => {
  const el = document.createElement('a');
  el.href = data.url;
  el.target = '_blank';
  el.textContent = data.label;
  el.style.cssText = `
    position:absolute; color:#00f5ff; font-family:'JetBrains Mono',monospace;
    font-size:1rem; font-weight:500; letter-spacing:0.1em; text-decoration:none;
    pointer-events:auto; cursor:pointer; opacity:0; transition:opacity 0.3s;
    text-shadow: 0 0 20px rgba(0,245,255,0.6), 0 0 40px rgba(0,245,255,0.3);
    background: rgba(0,245,255,0.08); padding: 6px 14px; border-radius: 6px;
    border: 1px solid rgba(0,245,255,0.15);
  `;
  // Email copy-to-clipboard handler
  if (data.email) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(data.email).then(() => {
        const original = el.textContent;
        el.textContent = 'Copied!';
        setTimeout(() => { el.textContent = original; }, 1500);
      });
    });
  }
  labelContainer.appendChild(el);
  return el;
});

// ── Scroll-driven state ──
let sectionProgress = 0; // 0–1 driven by ScrollTrigger scrub
let contactVisible = false; // true when section is within the viewport

// ── Project Labels to Screen ──
function updateLabels() {
  if (!contactVisible) {
    labelContainer.style.display = 'none';
    return;
  }
  labelContainer.style.display = '';

  nodes.forEach((node, i) => {
    const pos = node.mesh.position.clone().project(camera);
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

    const el = labelEls[i];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%, -50%)';

    // Labels fade in during progress 0.3–0.7
    const labelAlpha = THREE.MathUtils.clamp((sectionProgress - 0.3) / 0.4, 0, 1);
    el.style.opacity = labelAlpha;

    // Glow scales with progress
    const glowIntensity = THREE.MathUtils.clamp(sectionProgress * 4, 0, 2.5);
    node.light.intensity = glowIntensity;
    node.light.position.copy(node.mesh.position);

    // Sphere scale pulses slightly
    node.mesh.scale.setScalar(0.25 + sectionProgress * 0.1);

    // Update trailing line geometry: from node position to origin
    const linePositions = node.lineGeo.attributes.position.array;
    linePositions[0] = node.mesh.position.x;
    linePositions[1] = node.mesh.position.y;
    linePositions[2] = node.mesh.position.z;
    linePositions[3] = 0;
    linePositions[4] = 0;
    linePositions[5] = 0;
    node.lineGeo.attributes.position.needsUpdate = true;
  });
}

// ── Animate (called every frame by main.js) ──
function animate() {
  updateLabels();
}

// ── ScrollTrigger Reveal ──
// Fly-in tween objects, keyed by index, so we can control them
const flyInTweens = [];

function triggerFlyIn() {
  flyInTweens.forEach((t) => t && t.kill());
  flyInTweens.length = 0;

  nodes.forEach((node, i) => {
    // Reset to start position before animating
    node.mesh.position.copy(startPositions[i]);
    // Show line draw range
    node.lineGeo.setDrawRange(0, 0);

    const end = endPositions[i];
    const tween = gsap.to(node.mesh.position, {
      x: end.x,
      y: end.y,
      z: end.z,
      duration: 1.2,
      delay: i * 0.15,
      ease: 'elastic.out(1, 0.5)',
      onUpdate: () => {
        // Draw the line as the node travels in
        node.lineGeo.setDrawRange(0, 2);
        node.lineGeo.attributes.position.needsUpdate = true;
      },
    });
    flyInTweens.push(tween);
  });
}

function resetNodes() {
  nodes.forEach((node, i) => {
    node.mesh.position.copy(startPositions[i]);
    node.lineGeo.setDrawRange(0, 0);
    node.light.intensity = 0;
    labelEls[i].style.opacity = '0';
  });
}

function initContact() {
  // Scrub-driven progress: controls label fade + glow intensity
  ScrollTrigger.create({
    trigger: '#contact',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onEnter: () => { contactVisible = true; },
    onLeave: () => { contactVisible = false; },
    onEnterBack: () => { contactVisible = true; },
    onLeaveBack: () => { contactVisible = false; },
    onUpdate: (self) => {
      sectionProgress = self.progress;
    },
  });

  // Enter trigger: fires the fly-in animation once when section enters viewport
  ScrollTrigger.create({
    trigger: '#contact',
    start: 'top 70%',
    end: 'bottom top',
    onEnter: () => {
      triggerFlyIn();
    },
    onLeaveBack: () => {
      resetNodes();
    },
  });
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

export { scene, camera, animate, initContact, contactVisible };
