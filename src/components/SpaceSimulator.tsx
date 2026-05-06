import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Body = {
  name: string;
  radius: number; // visual
  distance: number; // AU-ish
  color: number;
  speed: number; // orbital speed factor
  emissive?: number;
  ring?: { inner: number; outer: number; color: number };
  info: string;
};

const BODIES: Body[] = [
  { name: "Sun", radius: 4, distance: 0, color: 0xffaa33, speed: 0, emissive: 0xffaa33, info: "G-type main-sequence star. Radius ~696,340 km. Surface temp ~5,778 K." },
  { name: "Mercury", radius: 0.5, distance: 8, color: 0xa0a0a0, speed: 4.15, info: "Smallest planet. Year: 88 days. No atmosphere." },
  { name: "Venus", radius: 0.9, distance: 11, color: 0xe8b87a, speed: 1.62, info: "Hottest planet. Thick CO₂ atmosphere. Day longer than year." },
  { name: "Earth", radius: 1.0, distance: 15, color: 0x3a78ff, speed: 1.0, info: "Our pale blue dot. Only known harbor of life. 1 AU from Sun." },
  { name: "Mars", radius: 0.7, distance: 19, color: 0xc1440e, speed: 0.53, info: "The red planet. Two moons: Phobos & Deimos. Olympus Mons: 22 km." },
  { name: "Jupiter", radius: 2.4, distance: 26, color: 0xd8a878, speed: 0.084, info: "Gas giant. Mass = 318 Earths. Great Red Spot is a centuries-old storm." },
  { name: "Saturn", radius: 2.0, distance: 33, color: 0xe0c890, speed: 0.034, ring: { inner: 2.6, outer: 4.2, color: 0xc8b890 }, info: "Famous rings of ice & rock. Density less than water." },
  { name: "Uranus", radius: 1.4, distance: 39, color: 0x88d8e0, speed: 0.012, info: "Ice giant tilted on its side (98°). Faint rings." },
  { name: "Neptune", radius: 1.35, distance: 44, color: 0x4060ff, speed: 0.006, info: "Windiest planet. Discovered by mathematics in 1846." },
];

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
    scene.background = new THREE.Color(0x000005);
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 5000);
    camera.position.set(0, 25, 55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 6000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 800 + Math.random() * 1500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = 0.6 + Math.random() * 0.4;
      const tint = Math.random();
      colors[i * 3] = c * (tint > 0.7 ? 1 : 0.9);
      colors[i * 3 + 1] = c * 0.95;
      colors[i * 3 + 2] = c * (tint < 0.3 ? 1 : 0.95);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.2, vertexColors: true, sizeAttenuation: false, transparent: true });
    scene.add(new THREE.Points(starGeo, starMat));

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.08);
    scene.add(ambient);
    const sunLight = new THREE.PointLight(0xffd9a0, 3, 0, 0);
    scene.add(sunLight);

    // Orbits + bodies
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    const meshes: { body: Body; mesh: THREE.Mesh; pivot: THREE.Object3D; ring?: THREE.Mesh }[] = [];

    BODIES.forEach((b) => {
      const pivot = new THREE.Object3D();
      pivot.rotation.y = Math.random() * Math.PI * 2;
      scene.add(pivot);

      const geo = new THREE.SphereGeometry(b.radius, 48, 48);
      const mat = b.emissive
        ? new THREE.MeshBasicMaterial({ color: b.color })
        : new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = b.distance;
      mesh.userData.name = b.name;
      pivot.add(mesh);

      if (b.emissive) {
        // Sun glow
        const glowGeo = new THREE.SphereGeometry(b.radius * 1.6, 32, 32);
        const glowMat = new THREE.ShaderMaterial({
          transparent: true,
          uniforms: { c: { value: new THREE.Color(b.emissive) } },
          vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
          fragmentShader: `varying vec3 vN; uniform vec3 c; void main(){ float i = pow(0.7 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(c, i); }`,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        });
        mesh.add(new THREE.Mesh(glowGeo, glowMat));
      }

      let ring: THREE.Mesh | undefined;
      if (b.ring) {
        const rGeo = new THREE.RingGeometry(b.ring.inner, b.ring.outer, 96);
        const rMat = new THREE.MeshBasicMaterial({ color: b.ring.color, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
        ring = new THREE.Mesh(rGeo, rMat);
        ring.rotation.x = Math.PI / 2.4;
        mesh.add(ring);
      }

      // Orbit line
      if (b.distance > 0) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 128; i++) {
          const a = (i / 128) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * b.distance, 0, Math.sin(a) * b.distance));
        }
        const oGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const oMat = new THREE.LineBasicMaterial({ color: 0x2a3550, transparent: true, opacity: 0.6 });
        const line = new THREE.LineLoop(oGeo, oMat);
        orbitGroup.add(line);
      }

      meshes.push({ body: b, mesh, pivot, ring });
    });

    // Earth's moon
    const moonPivot = new THREE.Object3D();
    const earthEntry = meshes.find((m) => m.body.name === "Earth")!;
    earthEntry.mesh.add(moonPivot);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1 })
    );
    moon.position.x = 2;
    moonPivot.add(moon);

    // Camera controls (orbit)
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let yaw = 0, pitch = 0.5;
    let distance = 60;
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
      distance *= 1 + e.deltaY * 0.001;
      distance = Math.max(6, Math.min(400, distance));
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // Click to select
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(meshes.map((m) => m.mesh));
      if (hit.length) {
        const name = hit[0].object.userData.name;
        const b = BODIES.find((x) => x.name === name);
        if (b) setSelected(b);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    // Resize
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // Animation
    let last = performance.now();
    let frames = 0;
    let fpsTimer = last;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      frames++;
      if (now - fpsTimer > 500) {
        setFps(Math.round((frames * 1000) / (now - fpsTimer)));
        frames = 0;
        fpsTimer = now;
      }

      const s = stateRef.current;
      const dts = s.paused ? 0 : dt * s.speed;

      meshes.forEach(({ body, mesh, pivot }) => {
        pivot.rotation.y += body.speed * 0.15 * dts;
        mesh.rotation.y += 0.5 * dt; // self spin
      });
      moonPivot.rotation.y += 1.5 * dts;

      orbitGroup.visible = s.showOrbits;

      // Focus tracking
      const focusEntry = meshes.find((m) => m.body.name === s.focus);
      if (focusEntry) {
        focusEntry.mesh.getWorldPosition(focusTarget);
        target.lerp(focusTarget, 0.1);
      } else {
        target.lerp(new THREE.Vector3(), 0.1);
      }

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
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-[0_0_18px_rgba(255,170,80,0.6)]" />
          <div>
            <div className="text-sm font-semibold tracking-wide">Luna</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Space Simulator</div>
          </div>
        </div>
        <div className="pointer-events-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md">
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
                style={{ background: `#${b.color.toString(16).padStart(6, "0")}` }}
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

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden text-[11px] text-white/40 md:block">
        Drag to orbit · Scroll to zoom · Click a planet
      </div>
    </div>
  );
}
