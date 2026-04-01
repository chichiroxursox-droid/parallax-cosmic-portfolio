import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Scene ──
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0, 10);

// Ambient fill
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

// ── Service data ──
const serviceData = [
  { label: 'AI-Powered Websites',    desc: 'Sites that think, adapt, and respond' },
  { label: 'Interactive Experiences', desc: 'WebGL, 3D, and immersive storytelling' },
  { label: 'Creative Development',   desc: 'From concept to pixel-perfect reality' },
  { label: 'Rapid Prototyping',      desc: 'Ideas to working demos in days' },
];

// 4 nodes with Z-depth variation
const nodePositions = [
  new THREE.Vector3(-3,    2,    2),
  new THREE.Vector3( 2.5,  0.5, -1),
  new THREE.Vector3(-1.5, -1.5,  4),
  new THREE.Vector3( 3,   -2,   -3),
];

// ── Constellation group (tiltable) ──
const constellationGroup = new THREE.Group();
scene.add(constellationGroup);

// ── Node meshes + lights ──
const AMBER = 0xc8b800;

const nodes = [];

nodePositions.forEach((pos) => {
  const geo = new THREE.SphereGeometry(0.15, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: AMBER });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.scale.setScalar(0); // start invisible — entrance animation sets it to 1
  constellationGroup.add(mesh);

  const light = new THREE.PointLight(AMBER, 0, 6);
  light.position.copy(pos);
  constellationGroup.add(light);

  nodes.push({ mesh, light, pos });
});

// ── Connecting lines ──
// Connect sequentially: 0→1, 1→2, 2→3, 3→0 (ring)
const lineSegments = [];

const connectionPairs = [[0,1],[1,2],[2,3],[3,0]];

connectionPairs.forEach(([a, b]) => {
  const posA = nodePositions[a];
  const posB = nodePositions[b];

  const positions = new Float32Array([
    posA.x, posA.y, posA.z,
    posB.x, posB.y, posB.z,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0); // drawn in via scroll

  const mat = new THREE.LineBasicMaterial({
    color: AMBER,
    transparent: true,
    opacity: 0.4,
  });

  const line = new THREE.Line(geo, mat);
  constellationGroup.add(line);
  lineSegments.push({ line, geo });
});

// ── Particle system (burst per node) ──
const PARTICLES_PER_NODE = 25;
const allParticles = []; // [{mesh, velocity, life, maxLife}]

function spawnBurst(nodePos) {
  for (let i = 0; i < PARTICLES_PER_NODE; i++) {
    const geo = new THREE.SphereGeometry(0.04, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(nodePos);
    constellationGroup.add(mesh);

    // Random outward velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 2,
    );

    allParticles.push({ mesh, velocity, life: 0, maxLife: 0.8 + Math.random() * 0.4 });
  }
}

function updateParticles(delta) {
  for (let i = allParticles.length - 1; i >= 0; i--) {
    const p = allParticles[i];
    p.life += delta;
    const t = p.life / p.maxLife;

    if (t >= 1) {
      constellationGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      allParticles.splice(i, 1);
      continue;
    }

    // Move outward
    p.mesh.position.addScaledVector(p.velocity, delta);
    // Fade out
    p.mesh.material.opacity = 1 - t;
    // Shrink slightly
    const scale = 1 - t * 0.5;
    p.mesh.scale.setScalar(scale);
  }
}

// ── CSS Label overlay ──
const labelContainer = document.createElement('div');
labelContainer.id = 'services-labels';
labelContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;';
document.body.appendChild(labelContainer);

const labelEls = serviceData.map((data) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute; transform:translate(-50%,-50%); text-align:center; opacity:0; transition:opacity 0.3s;';

  const label = document.createElement('span');
  label.className = 'constellation-label';
  label.textContent = data.label;
  label.style.display = 'block';

  const desc = document.createElement('span');
  desc.className = 'constellation-desc';
  desc.textContent = data.desc;
  desc.style.display = 'block';

  wrapper.appendChild(label);
  wrapper.appendChild(desc);
  labelContainer.appendChild(wrapper);
  return wrapper;
});

// ── Visibility flag (read by main.js) ──
let servicesVisible = false;

// ── Scroll progress ──
let sectionProgress = 0;

// ── Label projection ──
function updateLabels() {
  // Hide labels entirely when services section isn't visible
  if (!servicesVisible) {
    labelContainer.style.display = 'none';
    return;
  }
  labelContainer.style.display = '';

  nodes.forEach((node, i) => {
    const worldPos = node.mesh.position.clone();
    // Convert from group local space to world space
    constellationGroup.localToWorld(worldPos);

    const projected = worldPos.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    const el = labelEls[i];
    el.style.left = `${x}px`;
    el.style.top = `${y + 28}px`; // offset below the sphere
    el.style.transform = 'translate(-50%, 0)';

    // Labels fade in once nodes are materialised (progress > 0.15)
    const labelAlpha = THREE.MathUtils.clamp((sectionProgress - 0.15) / 0.3, 0, 1);
    el.style.opacity = labelAlpha * node.mesh.scale.x; // hides labels until nodes appear
  });
}

// ── Mouse tilt ──
let mouseX = 0;
let mouseY = 0;

const servicesEl = document.querySelector('#services');
if (servicesEl) {
  servicesEl.addEventListener('mousemove', (e) => {
    const rect = servicesEl.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;   // -1 to 1
    mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
  });

  servicesEl.addEventListener('mouseleave', () => {
    mouseX = 0;
    mouseY = 0;
  });
}

// ── Animate (called every frame by main.js) ──
const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05); // cap to prevent big jumps

  // Mouse parallax tilt — max ±5 degrees
  const maxTilt = (5 * Math.PI) / 180;
  constellationGroup.rotation.y = THREE.MathUtils.lerp(
    constellationGroup.rotation.y,
    mouseX * maxTilt,
    0.05
  );
  constellationGroup.rotation.x = THREE.MathUtils.lerp(
    constellationGroup.rotation.x,
    -mouseY * maxTilt,
    0.05
  );

  updateLabels();
  updateParticles(delta);
}

// ── Entrance animation ──
let entrancePlayed = false;

function triggerEntrance() {
  if (entrancePlayed) return;
  entrancePlayed = true;

  // 1. Nodes materialise with scale bounce + stagger
  nodes.forEach((node, i) => {
    gsap.to(node.mesh.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.5,
      delay: i * 0.18,
      ease: 'back.out(3)',
      onStart: () => {
        // Particle burst when this node appears
        spawnBurst(node.pos);
      },
      onComplete: () => {
        // Ramp up glow
        gsap.to(node.light, { intensity: 1.2, duration: 0.4 });
      },
    });
  });

  // 2. Lines draw in after nodes start appearing
  lineSegments.forEach((seg, i) => {
    gsap.delayedCall(0.3 + i * 0.25, () => {
      // Animate drawCount from 0 to 2 over 0.6s
      const obj = { count: 0 };
      gsap.to(obj, {
        count: 2,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          seg.geo.setDrawRange(0, Math.round(obj.count));
        },
      });
    });
  });
}

function resetEntrance() {
  entrancePlayed = false;

  // Hide nodes + lines
  nodes.forEach((node) => {
    node.mesh.scale.setScalar(0);
    node.light.intensity = 0;
  });
  lineSegments.forEach((seg) => {
    seg.geo.setDrawRange(0, 0);
  });
  labelEls.forEach((el) => {
    el.style.opacity = '0';
  });

  // Clean up any live particles
  allParticles.forEach((p) => {
    constellationGroup.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  allParticles.length = 0;
}

// ── Init ──
function initServices() {
  // Visibility + scrub progress
  ScrollTrigger.create({
    trigger: '#services',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onEnter: ()      => { servicesVisible = true; },
    onLeave: ()      => { servicesVisible = false; },
    onEnterBack: ()  => { servicesVisible = true; },
    onLeaveBack: ()  => { servicesVisible = false; },
    onUpdate: (self) => { sectionProgress = self.progress; },
  });

  // Entrance trigger
  ScrollTrigger.create({
    trigger: '#services',
    start: 'top 70%',
    end: 'bottom top',
    onEnter: ()     => { triggerEntrance(); },
    onLeaveBack: () => { resetEntrance(); },
  });
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

export { scene, camera, animate, initServices, servicesVisible };
