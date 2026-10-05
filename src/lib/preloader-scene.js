import {
  Box3, DirectionalLight, Euler, Group, MeshPhysicalMaterial, NeutralToneMapping,
  PMREMGenerator, PerspectiveCamera, Quaternion, SRGBColorSpace, Scene, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const DEPTH = 1.6;                 // mesma espessura da dobra 3D
const WINDOW = 0.42;               // fatia do progresso que cada peça leva para encaixar
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeOutBack = (t, s = 1.5) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;   // passa do ponto e volta: "encaixe"
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Logo 3D que se MONTA conforme o site carrega: as 17 peças começam espalhadas e
 * girando e vão encaixando em volta do círculo. `setProgress(0..1)` comanda a montagem;
 * `exit(0..1)` faz o giro final de saída.
 */
export async function createLoaderScene(canvas, buffer) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const key = new DirectionalLight(0xffffff, 1.5); key.position.set(3, 4, 5);
  const rim = new DirectionalLight(0x9fd8ff, 0.9); rim.position.set(-4, -2, 3);
  scene.add(key, rim);

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const span = Math.max(size.x, size.y);
  model.position.sub(center);

  const fit = new Group();
  const s = 2.3 / span;
  fit.scale.set(s, s, s * DEPTH);
  fit.add(model);
  const spin = new Group();
  spin.add(fit);
  scene.add(spin);

  /* ---------- peças: posição/rotação de partida espalhadas ---------- */
  const pieces = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mat = new MeshPhysicalMaterial({
      color: o.material.color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: o.material.color, emissiveIntensity: 0.08, envMapIntensity: 1.2,
      transparent: true, opacity: 0,
    });
    o.material = mat;

    // direção do centro do logo até a peça (as peças "chegam de fora para dentro")
    const c = new Box3().setFromObject(o).getCenter(new Vector3()).sub(center);
    const dir = c.lengthSq() > 1e-8 ? c.clone().setZ(0).normalize() : new Vector3(0, 0, 0);
    const isCenter = /Centro/.test(o.name);
    const from = new Vector3(
      dir.x * span * 0.75 + (Math.random() - 0.5) * span * 0.2,
      dir.y * span * 0.75 + (Math.random() - 0.5) * span * 0.2,
      (Math.random() - 0.5) * span * 0.9 + (isCenter ? span * 0.8 : 0),
    );
    const startQ = new Quaternion().setFromEuler(new Euler(
      (Math.random() - 0.5) * Math.PI * 1.6, (Math.random() - 0.5) * Math.PI * 1.6, (Math.random() - 0.5) * Math.PI,
    ));
    pieces.push({
      o, mat, from,
      home: o.position.clone(), homeQ: o.quaternion.clone(), startQ,
      angle: Math.atan2(dir.y, dir.x), disc: /Disco/.test(o.name), isCenter,
    });
  });

  // ordem de encaixe: corpos em volta do círculo, depois as cabeças, por fim o centro
  pieces.sort((a, b) => (a.isCenter - b.isCenter) || (a.disc - b.disc) || (a.angle - b.angle));
  pieces.forEach((p, i) => { p.start = (i / (pieces.length - 1)) * (1 - WINDOW); });

  /* ---------- estado ---------- */
  let progress = 0, exitK = 0, raf = 0, prev = performance.now(), time = 0;
  const tmp = new Vector3();

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = 8 / Math.min(1, camera.aspect * 1.2);   // celular: afasta a câmera
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize, { passive: true });
  resize();

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.05); prev = now; time += dt;

    for (const p of pieces) {
      const t = clamp01((progress - p.start) / WINDOW);
      const move = easeOutBack(t);
      tmp.copy(p.from).multiplyScalar(1 - move);
      p.o.position.copy(p.home).add(tmp);
      p.o.quaternion.slerpQuaternions(p.startQ, p.homeQ, easeOutCubic(t));
      p.mat.opacity = clamp01(t * 3) * (1 - exitK * exitK);
    }

    // enquanto monta, o conjunto gira devagar; montado, só "respira"
    const e = easeInOut(exitK);
    spin.rotation.y = (1 - easeOutCubic(progress)) * 1.1 + Math.sin(time * 0.8) * 0.12 + e * Math.PI * 2;
    spin.rotation.x = (1 - progress) * 0.35 + Math.sin(time * 0.6) * 0.06;
    spin.scale.setScalar(1 - e * 0.22);
    spin.position.y = 0.32 + e * 0.25;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { progress = clamp01(p); },
    exit(k) { exitK = clamp01(k); },
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();   // devolve o contexto WebGL para a dobra 3D usar depois
    },
  };
}
