import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Zoom scene ──
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 100;

// ── Clock for per-frame time ──
const clock = new THREE.Clock();

// ── Background stars ──
const starCount = 2000;
const starGeo = new THREE.BufferGeometry();
const positions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 400;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 400;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xe8eaf0, size: 0.4, sizeAttenuation: true });
scene.add(new THREE.Points(starGeo, starMat));

// ── Point light that pretends to be the sun ──
const starLight = new THREE.PointLight(0xff6b35, 3, 50);
starLight.position.set(0, 0, -500);
scene.add(starLight);

// ══════════════════════════════════════════════════════
//  GLSL helpers — simplex noise 3D (compact version)
// ══════════════════════════════════════════════════════
const glslNoise = /* glsl */`
// Simplex noise helpers
vec3 mod289v3(vec3 x){ return x - floor(x*(1./289.))*289.; }
vec4 mod289v4(vec4 x){ return x - floor(x*(1./289.))*289.; }
vec4 permute(vec4 x){ return mod289v4(((x*34.)+1.)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.792842914-0.8537347209*r; }

float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  vec4 i=floor(v+dot(v,C.yyy).xxxx);
  vec4 j=i; // placeholder
  vec3 x0=v-i.xyz+dot(i.xyz,C.xxx);
  vec3 g0=step(x0.yzx,x0.xyz);
  vec3 l0=1.-g0;
  vec3 i1=min(g0.xyz,l0.zxy);
  vec3 i2=max(g0.xyz,l0.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-0.5;
  i.xyz=mod289v3(i.xyz);
  vec4 perm=permute(permute(permute(
    i.z+vec4(0.,i1.z,i2.z,1.))
   +i.y+vec4(0.,i1.y,i2.y,1.))
   +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*vec3(7.,0.,-7.*(1./7.))-(vec3(0.,0.,1.)*vec4(2.,4.,6.,0.)).xyz;
  // simplified gradient — good enough for displacement
  vec4 gx=2.*fract(perm*ns.x)-1.;
  vec4 gy=abs(gx)-0.5;
  vec4 gz=floor(gx+0.5);
  gx=gx-gz;
  vec3 g1=vec3(gx.x,gy.x,gz.x);
  vec3 g2=vec3(gx.y,gy.y,gz.y);
  vec3 g3=vec3(gx.z,gy.z,gz.z);
  vec3 g4=vec3(gx.w,gy.w,gz.w);
  vec4 norm=taylorInvSqrt(vec4(dot(g1,g1),dot(g2,g2),dot(g3,g3),dot(g4,g4)));
  g1*=norm.x; g2*=norm.y; g3*=norm.z; g4*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(g1,x0),dot(g2,x1),dot(g3,x2),dot(g4,x3)));
}

// FBM — 4 octaves
float fbm(vec3 p){
  float v=0.; float a=0.5;
  for(int i=0;i<4;i++){ v+=a*snoise(p); p*=2.2; a*=0.5; }
  return v;
}
`;

// ══════════════════════════════════════════════════════
//  Layer 1 — Core
// ══════════════════════════════════════════════════════
const coreMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vNormal   = normalize(normalMatrix * normal);
      vPosition = (modelMatrix * vec4(position,1.)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1. - max(dot(viewDir, vNormal), 0.), 2.);
      vec3 centerColor = vec3(0.6, 0.2, 0.0);
      vec3 edgeColor   = vec3(1.0, 0.95, 0.7);
      vec3 color = mix(centerColor, edgeColor, fresnel);
      // Subtle pulsing brightness
      color *= 0.9 + 0.1 * sin(uTime * 2.3);
      gl_FragColor = vec4(color, 1.);
    }
  `,
});

const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 64), coreMat);

// ══════════════════════════════════════════════════════
//  Layer 2 — Chromosphere
// ══════════════════════════════════════════════════════
const chromoMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  vertexShader: /* glsl */`
    ${glslNoise}
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vec3 p = position + normal * snoise(position * 1.8 + uTime * 0.4) * 0.3;
      vNormal   = normalize(normalMatrix * normal);
      vPosition = (modelMatrix * vec4(p, 1.)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `,
  fragmentShader: /* glsl */`
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float rim = 1. - max(dot(viewDir, vNormal), 0.);
      rim = pow(rim, 1.8);
      vec3 color = mix(vec3(0.9, 0.35, 0.0), vec3(1.0, 0.7, 0.2), rim);
      gl_FragColor = vec4(color, rim * 0.55);
    }
  `,
});

const chromoMesh = new THREE.Mesh(new THREE.SphereGeometry(2.3, 48, 48), chromoMat);

// ══════════════════════════════════════════════════════
//  Layer 3 — Corona
// ══════════════════════════════════════════════════════
const coronaMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:   { value: 0 },
    uCorona: { value: 0.2 },
  },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.BackSide,
  vertexShader: /* glsl */`
    ${glslNoise}
    uniform float uTime;
    uniform float uCorona;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplace;
    void main(){
      float disp = fbm(position * 0.35 + uTime * 0.12) * 1.8;
      vDisplace = disp;
      vec3 p = position + normal * disp * uCorona * 0.4;
      vNormal   = normalize(normalMatrix * normal);
      vPosition = (modelMatrix * vec4(p, 1.)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uCorona;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplace;
    void main(){
      vec3 viewDir = normalize(cameraPosition - vPosition);
      // BackSide: normal points inward, so flip
      float rim = max(dot(-viewDir, vNormal), 0.);
      rim = pow(rim, 0.6);
      float intensity = uCorona * 0.08;
      vec3 color = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.9, 0.6), vDisplace * 0.5 + 0.5);
      gl_FragColor = vec4(color * intensity, rim * intensity * 0.6);
    }
  `,
});

const coronaMesh = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 32), coronaMat);

// ══════════════════════════════════════════════════════
//  Layer 4 — Flare rings (2x torus)
// ══════════════════════════════════════════════════════
const flareMat1 = new THREE.ShaderMaterial({
  uniforms: {
    uTime:        { value: 0 },
    uTurbulence:  { value: 0.3 },
    uOpacity:     { value: 0.0 },
  },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    uniform float uTime;
    uniform float uTurbulence;
    varying float vFade;
    void main(){
      vec3 p = position;
      p.y += sin(p.x * 4. + uTime * 2.) * uTurbulence;
      p.z += cos(p.x * 3. + uTime * 1.7) * uTurbulence * 0.5;
      vFade = abs(sin(p.x * 2. + uTime));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uOpacity;
    varying float vFade;
    void main(){
      vec3 color = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.9, 0.5), vFade);
      gl_FragColor = vec4(color, uOpacity * 0.7);
    }
  `,
});

const flareMat2 = new THREE.ShaderMaterial({
  uniforms: {
    uTime:        { value: 0 },
    uTurbulence:  { value: 0.3 },
    uOpacity:     { value: 0.0 },
  },
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    uniform float uTime;
    uniform float uTurbulence;
    varying float vFade;
    void main(){
      vec3 p = position;
      p.y += sin(p.x * 5. + uTime * 1.5) * uTurbulence;
      p.z += cos(p.x * 4. + uTime * 2.2) * uTurbulence * 0.4;
      vFade = abs(cos(p.x * 3. + uTime * 0.8));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uOpacity;
    varying float vFade;
    void main(){
      vec3 color = mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.75, 0.3), vFade);
      gl_FragColor = vec4(color, uOpacity * 0.5);
    }
  `,
});

const flareRing1 = new THREE.Mesh(new THREE.TorusGeometry(4, 0.08, 8, 128), flareMat1);
flareRing1.rotation.x = Math.PI * 0.17;  // ~30°

const flareRing2 = new THREE.Mesh(new THREE.TorusGeometry(4, 0.08, 8, 128), flareMat2);
flareRing2.rotation.x = Math.PI * 0.33;  // ~60°

// ══════════════════════════════════════════════════════
//  Sun group — same position as old starSphere
// ══════════════════════════════════════════════════════
const sunGroup = new THREE.Group();
sunGroup.position.set(0, 0, -500);
sunGroup.add(coreMesh, chromoMesh, coronaMesh, flareRing1, flareRing2);
scene.add(sunGroup);

// ── White flash overlay ──
const flashEl = document.createElement('div');
flashEl.style.cssText = 'position:fixed;inset:0;background:white;opacity:0;pointer-events:none;z-index:100;';
document.body.appendChild(flashEl);

// ── Narrative text overlay ──
const narrativeEl = document.createElement('div');
narrativeEl.textContent = 'Every project starts as a spark';
narrativeEl.style.cssText = [
  'position:fixed',
  'top:50%',
  'left:50%',
  'transform:translate(-50%,-50%) scale(0.85)',
  'font-family:var(--font-display,"Space Grotesk",sans-serif)',
  'font-style:italic',
  'font-size:clamp(1.4rem,4vw,3rem)',
  'font-weight:700',
  'color:#fff',
  'text-align:center',
  'letter-spacing:0.04em',
  'text-shadow:0 0 40px rgba(255,150,50,0.8),0 0 80px rgba(255,100,20,0.4)',
  'opacity:0',
  'pointer-events:none',
  'z-index:50',
  'transition:none',
  'white-space:nowrap',
].join(';');
document.body.appendChild(narrativeEl);

// ── State ──
let zoomProgress = 0;
let isActive = false;

// ── Smooth step helper ──
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function initZoom() {
  ScrollTrigger.create({
    trigger: '#zoom',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: (self) => {
      zoomProgress = self.progress;
      isActive = self.isActive;

      // ── Camera flies toward the sun ──
      camera.position.z = 100 - zoomProgress * 600;

      // ── Sun group — subtle scale so it reads as growth without looking wrong ──
      const groupScale = 1 + zoomProgress * 3;
      sunGroup.scale.setScalar(groupScale);

      // ── Point light intensity ──
      starLight.intensity = 3 + zoomProgress * 20;

      // ── Corona intensity ramps 0.2 → 3.0 ──
      const coronaIntensity = 0.2 + zoomProgress * 2.8;
      coronaMat.uniforms.uCorona.value = coronaIntensity;

      // ── Flare ring visibility — fade in after 0.3 ──
      const flareOpacity = smoothstep(0.3, 0.5, zoomProgress);
      flareMat1.uniforms.uOpacity.value = flareOpacity;
      flareMat2.uniforms.uOpacity.value = flareOpacity;

      // ── Flare turbulence — grows with progress ──
      const turbulence = 0.3 + zoomProgress * 0.7;
      flareMat1.uniforms.uTurbulence.value = turbulence;
      flareMat2.uniforms.uTurbulence.value = turbulence;

      // ── Narrative text — fade in 0.4→0.6, stay, fade out 0.7→0.8 ──
      let textOpacity = 0;
      if (zoomProgress >= 0.4 && zoomProgress < 0.7) {
        textOpacity = smoothstep(0.4, 0.6, zoomProgress);
      } else if (zoomProgress >= 0.7 && zoomProgress < 0.8) {
        textOpacity = 1 - smoothstep(0.7, 0.8, zoomProgress);
      }
      const textScale = 0.85 + zoomProgress * 0.25;
      narrativeEl.style.opacity = textOpacity;
      narrativeEl.style.transform = `translate(-50%,-50%) scale(${textScale})`;

      // ── White flash at 0.9+ ──
      if (zoomProgress > 0.9) {
        flashEl.style.opacity = Math.min(1, (zoomProgress - 0.9) / 0.1);
      } else {
        flashEl.style.opacity = 0;
      }
    },
    onLeave: () => {
      gsap.to(flashEl, { opacity: 0, duration: 0.4 });
    },
  });
}

function animate() {
  const elapsed = clock.getElapsedTime();

  // Push time uniforms to all shader layers
  coreMat.uniforms.uTime.value    = elapsed;
  chromoMat.uniforms.uTime.value  = elapsed;
  coronaMat.uniforms.uTime.value  = elapsed;
  flareMat1.uniforms.uTime.value  = elapsed;
  flareMat2.uniforms.uTime.value  = elapsed;

  // Slow ambient rotation of the whole sun
  if (sunGroup) {
    sunGroup.rotation.y = elapsed * 0.04;
    sunGroup.rotation.z = Math.sin(elapsed * 0.07) * 0.05;
  }
}

// ── Resize ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

export { scene, camera, animate, initZoom, isActive as zoomActive };
