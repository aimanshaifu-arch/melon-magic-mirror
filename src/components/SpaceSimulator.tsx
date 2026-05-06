import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Body = {
  name: string;
  radius: number;
  distance: number;
  color: number;
  speed: number;
  emissive?: number;
  ring?: { inner: number; outer: number; color: number };
  tilt?: number; // axial tilt radians
  atmosphere?: number; // hex color of atmospheric halo
  moons?: { radius: number; distance: number; speed: number; color: number }[];
  textureType?: "rocky" | "gas" | "ice" | "lava" | "earth" | "sun";
  info: string;
};

const BODIES: Body[] = [
  { name: "Sun", radius: 5, distance: 0, color: 0xffaa33, speed: 0, emissive: 0xffcc55, textureType: "sun", info: "G-type main-sequence star. Radius ~696,340 km. Surface temp ~5,778 K." },
  { name: "Mercury", radius: 0.55, distance: 9, color: 0x9a8b7a, speed: 4.15, tilt: 0.034, textureType: "rocky", info: "Smallest planet. Year: 88 days. No atmosphere." },
  { name: "Venus", radius: 0.95, distance: 13, color: 0xe8b87a, speed: 1.62, tilt: 3.09, atmosphere: 0xffcc88, textureType: "lava", info: "Hottest planet. Thick CO₂ atmosphere. Day longer than year." },
  { name: "Earth", radius: 1.0, distance: 17, color: 0x2a5fbf, speed: 1.0, tilt: 0.41, atmosphere: 0x66b3ff, textureType: "earth", moons: [{ radius: 0.27, distance: 2.2, speed: 1.5, color: 0xcccccc }], info: "Our pale blue dot. Only known harbor of life. 1 AU from Sun." },
  { name: "Mars", radius: 0.72, distance: 22, color: 0xc1440e, speed: 0.53, tilt: 0.44, atmosphere: 0xff8866, textureType: "rocky", moons: [{ radius: 0.08, distance: 1.4, speed: 2.5, color: 0x886655 }, { radius: 0.06, distance: 1.9, speed: 1.8, color: 0x776644 }], info: "The red planet. Two moons: Phobos & Deimos. Olympus Mons: 22 km." },
  { name: "Jupiter", radius: 2.6, distance: 32, color: 0xd8a878, speed: 0.084, tilt: 0.05, textureType: "gas", moons: [{ radius: 0.18, distance: 3.6, speed: 1.2, color: 0xddccaa }, { radius: 0.16, distance: 4.4, speed: 0.9, color: 0xaa8866 }, { radius: 0.22, distance: 5.2, speed: 0.6, color: 0x998877 }, { radius: 0.2, distance: 6.0, speed: 0.4, color: 0x665544 }], info: "Gas giant. Mass = 318 Earths. Great Red Spot is a centuries-old storm." },
  { name: "Saturn", radius: 2.2, distance: 42, color: 0xe0c890, speed: 0.034, tilt: 0.47, ring: { inner: 2.9, outer: 5.0, color: 0xd4c2a0 }, textureType: "gas", moons: [{ radius: 0.18, distance: 6.5, speed: 0.7, color: 0xccbb99 }], info: "Famous rings of ice & rock. Density less than water." },
  { name: "Uranus", radius: 1.5, distance: 50, color: 0x88d8e0, speed: 0.012, tilt: 1.71, ring: { inner: 2.1, outer: 2.5, color: 0x88d8e0 }, atmosphere: 0xaaeeff, textureType: "ice", info: "Ice giant tilted on its side (98°). Faint rings." },
  { name: "Neptune", radius: 1.45, distance: 57, color: 0x3050d0, speed: 0.006, tilt: 0.49, atmosphere: 0x4477ff, textureType: "ice", moons: [{ radius: 0.15, distance: 2.8, speed: 1.0, color: 0xbbaa99 }], info: "Windiest planet. Discovered by mathematics in 1846." },
];

// === Procedural texture generators ===
function makeNoiseTexture(type: Body["textureType"], baseColor: number): THREE.Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size / 2;
  const ctx = canvas.getContext("2d")!;
  const base = new THREE.Color(baseColor);

  // Fill base
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rand = (seed: number) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };

  if (type === "gas") {
    // Horizontal bands with turbulence
    for (let y = 0; y < canvas.height; y++) {
      const t = y / canvas.height;
      const band = Math.sin(t * Math.PI * 14) * 0.5 + Math.sin(t * Math.PI * 5 + 1.3) * 0.3;
      const c = base.clone().offsetHSL(0, 0, band * 0.18);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(0, y, canvas.width, 1);
    }
    // Storm spots
    for (let i = 0; i < 30; i++) {
      const x = rand(i * 1.7) * canvas.width;
      const y = rand(i * 2.3) * canvas.height;
      const r = 8 + rand(i * 3.1) * 30;
      const c = base.clone().offsetHSL(0, 0, (rand(i) - 0.5) * 0.3);
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `#${c.getHexString()}`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === "earth") {
    // Ocean base
    ctx.fillStyle = "#1a4a8a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Continents (random blobs)
    for (let i = 0; i < 90; i++) {
      const x = rand(i * 1.1) * canvas.width;
      const y = rand(i * 2.7) * canvas.height;
      const r = 15 + rand(i * 3.3) * 40;
      const green = `hsl(${90 + rand(i) * 40}, 45%, ${25 + rand(i * 5) * 20}%)`;
      ctx.fillStyle = green;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Ice caps
    ctx.fillStyle = "#eef5ff";
    ctx.fillRect(0, 0, canvas.width, 18);
    ctx.fillRect(0, canvas.height - 18, canvas.width, 18);
    // Cloud overlay
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 60; i++) {
      const x = rand(i * 4.1 + 100) * canvas.width;
      const y = rand(i * 5.7 + 200) * canvas.height;
      const r = 20 + rand(i * 6) * 30;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "white"); grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (type === "lava") {
    for (let i = 0; i < 200; i++) {
      const x = rand(i) * canvas.width;
      const y = rand(i * 2) * canvas.height;
      const r = 10 + rand(i * 3) * 40;
      const c = base.clone().offsetHSL((rand(i) - 0.5) * 0.05, 0, (rand(i * 4) - 0.5) * 0.3);
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `#${c.getHexString()}`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === "ice") {
    // Smooth gradient bands
    for (let y = 0; y < canvas.height; y++) {
      const t = y / canvas.height;
      const c = base.clone().offsetHSL(0, 0, Math.sin(t * Math.PI * 3) * 0.08);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(0, y, canvas.width, 1);
    }
    for (let i = 0; i < 15; i++) {
      const y = rand(i) * canvas.height;
      ctx.fillStyle = `rgba(255,255,255,0.08)`;
      ctx.fillRect(0, y, canvas.width, 2 + rand(i * 2) * 4);
    }
  } else if (type === "sun") {
    // Plasma-like
    const grd = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
    grd.addColorStop(0, "#fff5d0");
    grd.addColorStop(0.5, "#ffaa33");
    grd.addColorStop(1, "#cc4400");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 400; i++) {
      const x = rand(i) * canvas.width;
      const y = rand(i * 2.1) * canvas.height;
      const r = 3 + rand(i * 3) * 15;
      ctx.fillStyle = `rgba(255,${180 + rand(i) * 60},${50 + rand(i * 4) * 80},${0.3 + rand(i * 5) * 0.4})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // rocky with craters
    for (let i = 0; i < 300; i++) {
      const x = rand(i) * canvas.width;
      const y = rand(i * 2) * canvas.height;
      const r = 2 + rand(i * 3) * 16;
      const c = base.clone().offsetHSL(0, 0, (rand(i * 5) - 0.5) * 0.25);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,0.3)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function makeRingTexture(color: number): THREE.Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const base = new THREE.Color(color);
  for (let x = 0; x < size; x++) {
    const t = x / size;
    const noise = Math.sin(t * 80) * 0.3 + Math.sin(t * 200) * 0.2 + Math.random() * 0.15;
    const alpha = Math.max(0, 0.6 + noise);
    // Cassini-like gaps
    const gap = Math.abs(t - 0.55) < 0.015 ? 0 : Math.abs(t - 0.78) < 0.008 ? 0.2 : 1;
    const c = base.clone().offsetHSL(0, 0, noise * 0.1);
    ctx.fillStyle = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha * gap})`;
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function SpaceSimulator() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Body | null>(BODIES[3]);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [fps, setFps] = useState(60);

  const stateRef = useRef({ paused: false, speed: 1, showOrbits: true, showLabels: true, focus: "Earth" });
  useEffect(() => {
    stateRef.current = { paused, speed, showOrbits, showLabels, focus: selected?.name ?? "" };
  }, [paused, speed, showOrbits, showLabels, selected]);

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000003);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 8000);
    camera.position.set(0, 28, 65);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // === Multi-layer starfield ===
    const makeStars = (count: number, minR: number, maxR: number, sizeMin: number, sizeMax: number) => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const r = minR + Math.random() * (maxR - minR);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        const tint = Math.random();
        const c = 0.5 + Math.random() * 0.5;
        if (tint < 0.15) { colors[i*3]=c; colors[i*3+1]=c*0.7; colors[i*3+2]=c*0.6; }
        else if (tint < 0.3) { colors[i*3]=c*0.7; colors[i*3+1]=c*0.8; colors[i*3+2]=c; }
        else { colors[i*3]=c; colors[i*3+1]=c; colors[i*3+2]=c; }
        sizes[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      return geo;
    };

    // Star shader for twinkle
    const starMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        varying float vSize;
        uniform float time;
        void main() {
          vColor = color;
          vSize = size;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float twinkle = 0.7 + 0.3 * sin(time * 2.0 + position.x * 0.01 + position.y * 0.013);
          gl_PointSize = size * twinkle;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(makeStars(8000, 1500, 3000, 1.0, 2.5), starMat));
    scene.add(new THREE.Points(makeStars(2000, 800, 1500, 2.0, 4.0), starMat));

    // Nebula clouds
    const nebulaColors = [0x4422aa, 0xaa2266, 0x226688];
    nebulaColors.forEach((col, idx) => {
      const geo = new THREE.SphereGeometry(2000 + idx * 200, 32, 32);
      const mat = new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(col) }, seed: { value: idx * 7.3 } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `
          varying vec3 vP; uniform vec3 c; uniform float seed;
          float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))+seed)*43758.5453); }
          float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
          void main(){
            vec3 p = normalize(vP) * 4.0;
            float n = noise(p) * 0.5 + noise(p*2.0)*0.25 + noise(p*4.0)*0.125;
            float a = smoothstep(0.55, 0.85, n) * 0.18;
            gl_FragColor = vec4(c, a);
          }`,
        transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Mesh(geo, mat));
    });

    // === Lights ===
    scene.add(new THREE.AmbientLight(0xffffff, 0.06));
    const sunLight = new THREE.PointLight(0xffeac0, 4, 0, 1.2);
    scene.add(sunLight);

    // === Bodies ===
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);
    type Entry = { body: Body; mesh: THREE.Mesh; pivot: THREE.Object3D; ring?: THREE.Mesh; atmosphere?: THREE.Mesh; clouds?: THREE.Mesh; label?: THREE.Sprite };
    const entries: Entry[] = [];

    const makeLabel = (text: string): THREE.Sprite => {
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
      const cx = cv.getContext("2d")!;
      cx.font = "600 28px system-ui, -apple-system, sans-serif";
      cx.fillStyle = "rgba(255,255,255,0.92)";
      cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.shadowColor = "rgba(0,0,0,0.8)"; cx.shadowBlur = 8;
      cx.fillText(text, 128, 32);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(8, 2, 1);
      return sprite;
    };

    BODIES.forEach((b) => {
      const pivot = new THREE.Object3D();
      pivot.rotation.y = Math.random() * Math.PI * 2;
      // slight orbital inclination
      pivot.rotation.x = (Math.random() - 0.5) * 0.05;
      scene.add(pivot);

      const tex = makeNoiseTexture(b.textureType, b.color);
      const geo = new THREE.SphereGeometry(b.radius, 64, 64);
      const mat = b.emissive
        ? new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff })
        : new THREE.MeshStandardMaterial({ map: tex, roughness: b.textureType === "ice" ? 0.4 : 0.85, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = b.distance;
      mesh.userData.name = b.name;
      if (b.tilt) mesh.rotation.z = b.tilt;
      pivot.add(mesh);

      // Sun corona (multi-layer)
      if (b.emissive) {
        for (let i = 0; i < 3; i++) {
          const scale = 1.4 + i * 0.5;
          const glowMat = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: { c: { value: new THREE.Color(b.emissive) }, p: { value: 3.0 - i * 0.7 } },
            vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
            fragmentShader: `varying vec3 vN; uniform vec3 c; uniform float p; void main(){ float i = pow(0.75 - dot(vN, vec3(0,0,1.0)), p); gl_FragColor = vec4(c, i * 0.55); }`,
            blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
          });
          const glow = new THREE.Mesh(new THREE.SphereGeometry(b.radius * scale, 32, 32), glowMat);
          mesh.add(glow);
        }
      }

      // Atmosphere halo
      let atmosphere: THREE.Mesh | undefined;
      if (b.atmosphere) {
        const atmMat = new THREE.ShaderMaterial({
          uniforms: { c: { value: new THREE.Color(b.atmosphere) } },
          vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
          fragmentShader: `varying vec3 vN; uniform vec3 c; void main(){ float i = pow(0.7 - dot(vN, vec3(0,0,1.0)), 2.5); gl_FragColor = vec4(c, i * 0.7); }`,
          transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        atmosphere = new THREE.Mesh(new THREE.SphereGeometry(b.radius * 1.12, 48, 48), atmMat);
        mesh.add(atmosphere);
      }

      // Cloud layer for Earth
      let clouds: THREE.Mesh | undefined;
      if (b.textureType === "earth") {
        const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
        const cx = cv.getContext("2d")!;
        cx.fillStyle = "rgba(0,0,0,0)"; cx.fillRect(0,0,512,256);
        for (let i = 0; i < 80; i++) {
          const x = Math.random() * 512; const y = Math.random() * 256;
          const r = 15 + Math.random() * 35;
          const grd = cx.createRadialGradient(x,y,0,x,y,r);
          grd.addColorStop(0, "rgba(255,255,255,0.85)");
          grd.addColorStop(1, "rgba(255,255,255,0)");
          cx.fillStyle = grd; cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.fill();
        }
        const ctex = new THREE.CanvasTexture(cv); ctex.colorSpace = THREE.SRGBColorSpace;
        clouds = new THREE.Mesh(
          new THREE.SphereGeometry(b.radius * 1.015, 48, 48),
          new THREE.MeshStandardMaterial({ map: ctex, transparent: true, opacity: 0.7, depthWrite: false })
        );
        mesh.add(clouds);
      }

      // Rings
      let ring: THREE.Mesh | undefined;
      if (b.ring) {
        const rGeo = new THREE.RingGeometry(b.ring.inner, b.ring.outer, 128, 8);
        // adjust UVs for radial texture
        const pos = rGeo.attributes.position;
        const uv = rGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i);
          const r = Math.sqrt(x*x + y*y);
          const t = (r - b.ring.inner) / (b.ring.outer - b.ring.inner);
          uv.setXY(i, t, 0.5);
        }
        const ringTex = makeRingTexture(b.ring.color);
        const rMat = new THREE.MeshBasicMaterial({ map: ringTex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        ring = new THREE.Mesh(rGeo, rMat);
        ring.rotation.x = Math.PI / 2;
        if (b.tilt) ring.rotation.y = b.tilt;
        mesh.add(ring);
      }

      // Moons
      if (b.moons) {
        b.moons.forEach((m) => {
          const mp = new THREE.Object3D();
          mp.rotation.y = Math.random() * Math.PI * 2;
          mp.rotation.x = (Math.random() - 0.5) * 0.3;
          mesh.add(mp);
          const mm = new THREE.Mesh(
            new THREE.SphereGeometry(m.radius, 24, 24),
            new THREE.MeshStandardMaterial({ map: makeNoiseTexture("rocky", m.color), roughness: 1 })
          );
          mm.position.x = m.distance;
          mp.add(mm);
          mp.userData.speed = m.speed;
          mp.userData.isMoon = true;
        });
      }

      // Orbit line (gradient via vertex colors)
      if (b.distance > 0) {
        const segs = 256;
        const positions = new Float32Array((segs + 1) * 3);
        const colors = new Float32Array((segs + 1) * 3);
        const baseCol = new THREE.Color(b.color);
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          positions[i*3] = Math.cos(a) * b.distance;
          positions[i*3+1] = 0;
          positions[i*3+2] = Math.sin(a) * b.distance;
          const fade = 0.15 + 0.5 * (Math.sin(a * 0.5) * 0.5 + 0.5);
          colors[i*3] = baseCol.r * fade;
          colors[i*3+1] = baseCol.g * fade;
          colors[i*3+2] = baseCol.b * fade;
        }
        const oGeo = new THREE.BufferGeometry();
        oGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        oGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const oMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 });
        orbitGroup.add(new THREE.LineLoop(oGeo, oMat));
      }

      // Label
      const label = makeLabel(b.name);
      label.position.y = b.radius + 1.2;
      mesh.add(label);

      entries.push({ body: b, mesh, pivot, ring, atmosphere, clouds, label });
    });

    // === Asteroid belt (Mars-Jupiter) ===
    const asteroidGroup = new THREE.Group();
    scene.add(asteroidGroup);
    const asteroidGeo = new THREE.BufferGeometry();
    const asteroidCount = 1500;
    const aPos = new Float32Array(asteroidCount * 3);
    const aCol = new Float32Array(asteroidCount * 3);
    for (let i = 0; i < asteroidCount; i++) {
      const r = 25 + Math.random() * 4.5;
      const a = Math.random() * Math.PI * 2;
      aPos[i*3] = Math.cos(a) * r;
      aPos[i*3+1] = (Math.random() - 0.5) * 0.6;
      aPos[i*3+2] = Math.sin(a) * r;
      const g = 0.4 + Math.random() * 0.4;
      aCol[i*3] = g; aCol[i*3+1] = g * 0.85; aCol[i*3+2] = g * 0.7;
    }
    asteroidGeo.setAttribute("position", new THREE.BufferAttribute(aPos, 3));
    asteroidGeo.setAttribute("color", new THREE.BufferAttribute(aCol, 3));
    asteroidGroup.add(new THREE.Points(asteroidGeo, new THREE.PointsMaterial({ size: 0.15, vertexColors: true, sizeAttenuation: true })));

    // Kuiper belt
    const kuiperGeo = new THREE.BufferGeometry();
    const kCount = 2500;
    const kPos = new Float32Array(kCount * 3);
    for (let i = 0; i < kCount; i++) {
      const r = 65 + Math.random() * 12;
      const a = Math.random() * Math.PI * 2;
      kPos[i*3] = Math.cos(a) * r;
      kPos[i*3+1] = (Math.random() - 0.5) * 1.5;
      kPos[i*3+2] = Math.sin(a) * r;
    }
    kuiperGeo.setAttribute("position", new THREE.BufferAttribute(kPos, 3));
    scene.add(new THREE.Points(kuiperGeo, new THREE.PointsMaterial({ size: 0.12, color: 0x88aacc, sizeAttenuation: true, transparent: true, opacity: 0.6 })));

    // === Camera controls ===
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let yaw = 0.4, pitch = 0.45;
    let distance = 65;
    let targetDistance = 65;
    const target = new THREE.Vector3();
    const focusTarget = new THREE.Vector3();

    const onDown = (e: PointerEvent) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; };
    const onUp = () => { isDragging = false; };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      yaw -= (e.clientX - prevX) * 0.005;
      pitch -= (e.clientY - prevY) * 0.005;
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      prevX = e.clientX; prevY = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetDistance *= 1 + e.deltaY * 0.001;
      targetDistance = Math.max(3, Math.min(500, targetDistance));
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // Click to select
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = { x: 0, y: 0, t: 0 };
    renderer.domElement.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    const onClick = (e: MouseEvent) => {
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      if (moved > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(entries.map((m) => m.mesh));
      if (hit.length) {
        const name = hit[0].object.userData.name;
        const b = BODIES.find((x) => x.name === name);
        if (b) setSelected(b);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // === Animation loop ===
    let last = performance.now();
    let frames = 0;
    let fpsTimer = last;
    let elapsed = 0;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      frames++;
      if (now - fpsTimer > 500) {
        setFps(Math.round((frames * 1000) / (now - fpsTimer)));
        frames = 0; fpsTimer = now;
      }

      starMat.uniforms.time.value = elapsed;

      const s = stateRef.current;
      const dts = s.paused ? 0 : dt * s.speed;

      entries.forEach(({ body, mesh, pivot, clouds, label }) => {
        pivot.rotation.y += body.speed * 0.15 * dts;
        mesh.rotation.y += (body.emissive ? 0.1 : 0.4) * dt;
        if (clouds) clouds.rotation.y += 0.05 * dt + 0.02 * dts;
        if (label) label.visible = s.showLabels;

        // animate moon pivots
        mesh.children.forEach((c) => {
          if (c.userData.isMoon) c.rotation.y += c.userData.speed * dts;
        });
      });

      orbitGroup.visible = s.showOrbits;
      asteroidGroup.rotation.y += 0.01 * dts;

      // Focus tracking
      const focusEntry = entries.find((m) => m.body.name === s.focus);
      if (focusEntry) {
        focusEntry.mesh.getWorldPosition(focusTarget);
        target.lerp(focusTarget, 0.08);
      } else {
        target.lerp(new THREE.Vector3(), 0.08);
      }

      distance += (targetDistance - distance) * 0.12;

      const cx = target.x + Math.cos(yaw) * Math.cos(pitch) * distance;
      const cy = target.y + Math.sin(pitch) * distance;
      const cz = target.z + Math.sin(yaw) * Math.cos(pitch) * distance;
      camera.position.set(cx, cy, cz);
      camera.lookAt(target);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Subtle vignette over canvas */}
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-[0_0_18px_rgba(255,170,80,0.6)]" />
          <div>
            <div className="text-sm font-semibold tracking-wide">Luna</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Space Simulator</div>
          </div>
        </div>
        <div className="pointer-events-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-white/70 backdrop-blur-md">
          {fps} fps
        </div>
      </div>

      {/* Left panel - bodies */}
      <aside className="pointer-events-auto absolute left-4 top-20 z-10 hidden w-64 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-md md:block">
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">Solar System</div>
        <div className="space-y-1">
          {BODIES.map((b) => (
            <button
              key={b.name}
              onClick={() => setSelected(b)}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                selected?.name === b.name ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full ring-1 ring-white/20"
                style={{ background: `#${b.color.toString(16).padStart(6, "0")}`, boxShadow: `0 0 8px #${b.color.toString(16).padStart(6, "0")}66` }}
              />
              {b.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Right panel - info */}
      {selected && (
        <aside className="pointer-events-auto absolute right-4 top-20 z-10 w-72 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Selected</div>
          <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{selected.info}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-white/40">Distance</div>
              <div className="font-mono text-white/90">{selected.distance.toFixed(1)} AU*</div>
            </div>
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-white/40">Speed</div>
              <div className="font-mono text-white/90">{selected.speed.toFixed(2)}×</div>
            </div>
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-white/40">Radius</div>
              <div className="font-mono text-white/90">{selected.radius.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-white/40">Moons</div>
              <div className="font-mono text-white/90">{selected.moons?.length ?? 0}</div>
            </div>
          </div>
        </aside>
      )}

      {/* Bottom controls */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
        <button
          onClick={() => setPaused((p) => !p)}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
        >
          {paused ? "▶ Play" : "❚❚ Pause"}
        </button>
        <div className="flex items-center gap-2 px-2 text-xs text-white/60">
          <span>Speed</span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="h-1 w-32 accent-amber-400"
          />
          <span className="w-10 font-mono">{speed.toFixed(1)}×</span>
        </div>
        <button
          onClick={() => setShowOrbits((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-xs ${showOrbits ? "bg-white/15" : "bg-white/5 text-white/60"}`}
        >
          Orbits
        </button>
        <button
          onClick={() => setShowLabels((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-xs ${showLabels ? "bg-white/15" : "bg-white/5 text-white/60"}`}
        >
          Labels
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden text-[11px] text-white/40 md:block">
        Drag to orbit · Scroll to zoom · Click a planet
      </div>
    </div>
  );
}
