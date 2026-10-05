import {
  AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, EdgesGeometry, Group, HalfFloatType, LineBasicMaterial, LineDashedMaterial, LineSegments, MathUtils, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, NeutralToneMapping, OrthographicCamera, PMREMGenerator, PerspectiveCamera, PlaneGeometry, Points, SRGBColorSpace, Scene, ShaderMaterial, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getModelBuffer } from './model-buffer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */
const STAGES = [
  { name: 'Sobre nós',      bg: ['#123a31', '#03090a'], accent: '#8dffbf', dust: '#a6f07a', dustCount: 700 },
  { name: 'Diagnóstico', bg: ['#14304a', '#040a12'], accent: '#ffe08a', dust: '#ffffff', dustCount: 320 },
  { name: 'Consequência', bg: ['#0b3150', '#02070f'], accent: '#49d2ff', dust: '#49d2ff', dustCount: 380 },
  { name: 'Método',     bg: ['#33163f', '#07040b'], accent: '#ff7fbf', dust: '#ffc2dd', dustCount: 320 },
];
const SEG = 1.8;          // telas de rolagem por transição
const HOLD = 0.15;        // fração no início e no fim de cada trecho em que a cena fica parada
const TURN = Math.PI * 2; // uma volta por transição: sempre para de frente
const SLOPE = -0.26;      // inclinação da linha de corte
const DEPTH = 1.6;        // engrossa o logo (ele é bem fino no .glb)

const N = STAGES.length;

/**
 * Monta a cena 3D dentro de `section` (o <section class="t3d"> renderizado pelo React).
 * Devolve uma função que desmonta tudo (listeners, loop, GPU) — usada no cleanup do useEffect.
 */
export function initDobra3D(section) {
const isMobile = matchMedia('(max-width: 820px)').matches;
const SHIFT = isMobile ? 6 : 22;  // quanto o texto desliza (vh) durante o corte
const startP = new URLSearchParams(location.search).get('p'); // ?p=1.5 abre já nesse ponto da dobra 3D
const $ = (id) => section.querySelector('#' + id);
const cleanups = [];
let disposed = false, rafId = 0;

/* ============================================================
   RENDERER / CENA
   ============================================================ */
const sticky = section.querySelector('.t3d-sticky');
const canvas = $('t3d-gl');
const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// qualidade: começa em até 1.5x e cai sozinha se a máquina não aguentar 60 fps
const PR_MAX = Math.min(devicePixelRatio, 1.5);
const PR_MIN = Math.min(devicePixelRatio, 0.85);
let PR = PR_MAX;
renderer.setPixelRatio(PR);
renderer.transmissionResolutionScale = 0.5;        // a refração do vidro em meia resolução
renderer.toneMapping = NeutralToneMapping;   // aplicado só na composição final
renderer.outputColorSpace = SRGBColorSpace;

const scene = new Scene();
const pmrem = new PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0, 7);

const key = new DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5);
const rim = new DirectionalLight(0x9fd8ff, 1.0); rim.position.set(-4, -2, 3);
for (const l of [key, rim]) { l.layers.enableAll(); scene.add(l); }

const uTime = { value: 0 };
const uPR = { value: PR };

// duas cenas renderizadas em texturas e depois misturadas pela linha de corte
const rtOpts = { type: HalfFloatType, samples: 2 };
const rtA = new WebGLRenderTarget(1, 1, rtOpts);
const rtB = new WebGLRenderTarget(1, 1, rtOpts);

/* ---------- fundo de cada cena (degradê + faixa de luz diagonal) ---------- */
const bgMats = [];
STAGES.forEach((s, i) => {
  const mat = new ShaderMaterial({
    uniforms: { c1: { value: new Color(s.bg[0]) }, c2: { value: new Color(s.bg[1]) }, uAspect: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: `
      uniform vec3 c1, c2; uniform float uAspect; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5; p.x *= uAspect;
        float d = length(p * vec2(0.85, 1.1));
        vec3 col = mix(c1, c2, smoothstep(0.0, 0.9, d));
        col += c1 * 0.55 * exp(-abs(p.y + p.x * 0.55 - 0.18) * 5.0) * smoothstep(-0.9, 0.4, p.x);
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: false, depthTest: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false; quad.renderOrder = -1000; quad.layers.set(i);
  scene.add(quad); bgMats.push(mat);
});

/* ---------- poeira / bokeh de cada cena ---------- */
STAGES.forEach((s, i) => {
  const n = Math.round(s.dustCount * (isMobile ? .6 : 1));
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    pos[k*3] = (Math.random() - .5) * 13;
    pos[k*3+1] = (Math.random() - .5) * 7;
    pos[k*3+2] = -4 + Math.random() * 6;
    rnd[k] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new BufferAttribute(rnd, 1));
  const m = new ShaderMaterial({
    uniforms: { uTime, uPR, uColor: { value: new Color(s.dust) } },
    vertexShader: `
      attribute float aRnd; uniform float uTime, uPR; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * 0.07 * (0.3 + aRnd) + 3.5, 7.0) - 3.5;
        p.x += sin(uTime * 0.3 + aRnd * 40.0) * 0.15;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPR * (1.5 + aRnd * aRnd * 7.0) * (7.0 / -mv.z);
        vA = 0.25 + 0.75 * fract(aRnd * 17.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vA;
        gl_FragColor = vec4(uColor * a * 0.9, a);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const pts = new Points(g, m);
  pts.frustumCulled = false; pts.layers.set(i);
  scene.add(pts);
});

/* ============================================================
   MATERIAIS DO LOGO (um por cena)
   ============================================================ */
// 0 · vidro iridescente
const glassMat = new MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.05,
  transmission: 1, thickness: 1.4, ior: 1.6, dispersion: 0.6,
  iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 820],
  clearcoat: 1, clearcoatRoughness: 0.04,
  attenuationColor: new Color('#d6fff0'), attenuationDistance: 1.5,
  envMapIntensity: 2.6, specularIntensity: 1,
});
const glassEdge = new LineBasicMaterial({
  color: '#e9fff6', transparent: true, opacity: .35, blending: AdditiveBlending, depthWrite: false,
});

// 1 · glitter: pontos que piscam
const sparkMat = (color) => new ShaderMaterial({
  uniforms: { uTime, uPR, uColor: { value: color } },
  vertexShader: `
    attribute float aRnd; uniform float uTime, uPR; varying float vTw, vR;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      vTw = 0.45 + 0.55 * sin(uTime * (1.5 + aRnd * 3.5) + aRnd * 60.0);
      vR = aRnd;
      gl_PointSize = uPR * (1.4 + aRnd * 1.8) * (7.0 / -mv.z);
    }`,
  fragmentShader: `
    uniform vec3 uColor; varying float vTw, vR;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      vec3 col = mix(uColor, vec3(1.0), step(0.92, vR) * 0.7);
      gl_FragColor = vec4(col * a * (0.35 + vTw) * 1.5, a);
    }`,
  transparent: true, depthWrite: false, blending: AdditiveBlending,
});

// 2 · holograma: fresnel + linhas de varredura + granulado
const holoMat = new ShaderMaterial({
  uniforms: { uTime, uColor: { value: new Color('#2fb8ff') } },
  vertexShader: `
    varying vec3 vN, vV, vW;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      vW = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uTime; uniform vec3 uColor; varying vec3 vN, vV, vW;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
      float scan = smoothstep(0.6, 1.0, sin(vW.y * 90.0 - uTime * 5.0) * 0.5 + 0.5);
      float sweep = exp(-abs(fract(vW.y * 0.25 - uTime * 0.18) - 0.5) * 18.0);
      float grain = hash(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 18.0));
      float a = 0.12 + fr * 0.9 + scan * 0.12 + grain * 0.22 + sweep * 0.35;
      gl_FragColor = vec4(uColor * a * 1.3, a);
    }`,
  transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
});
const holoDash = (q) => new LineDashedMaterial({
  color: '#9fe8ff', dashSize: 0.006 / q, gapSize: 0.004 / q, transparent: true, opacity: 0.95,
  blending: AdditiveBlending, depthWrite: false,
});

/* ============================================================
   MODELO
   ============================================================ */
const pivot = new Group();   // inclinação com o mouse
const spin = new Group();    // giro com o scroll
const fit = new Group();     // centraliza / escala
pivot.add(spin); spin.add(fit); scene.add(pivot);

const add = (parent, obj, layer) => { obj.layers.set(layer); parent.add(obj); return obj; };

const $loader = $('t3d-loader');
const nextTask = () => new Promise(r => setTimeout(r, 0));   // devolve a vez ao navegador (scroll sem engasgo)

async function buildModel() {
  // o .glb vem comprimido (meshopt + quantização): ~250 KB em vez de 4,8 MB
  // o arquivo é o mesmo que a tela de carregamento já baixou: vem do mesmo download, sem rede
  const buffer = await getModelBuffer((p) => { $('t3d-pct').textContent = ' ' + Math.round(p * 100) + '%'; });
  if (disposed) return;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
  if (disposed) return;
  const model = gltf.scene;
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  model.position.sub(center);
  const s = 2.35 / Math.max(size.x, size.y);
  fit.scale.set(s, s, s * DEPTH);
  fit.add(model);

  const meshes = [];
  model.traverse(o => { if (o.isMesh) meshes.push(o); });

  // distribui os pontos do glitter proporcionalmente à área de cada peça
  const samplers = meshes.map(m => new MeshSurfaceSampler(m).build());
  // (a área vem na escala comprimida de cada peça; × escala² volta para a medida real)
  const areas = samplers.map((sm, k) => sm.distribution[sm.distribution.length - 1] * meshes[k].scale.x ** 2 * (/Disco/.test(meshes[k].name) ? 1.6 : 1));
  const totalArea = areas.reduce((a, b) => a + b, 0);
  const TOTAL = isMobile ? 35000 : 70000;
  const hsl = {};
  const p = new Vector3(), n = new Vector3();

  for (const [idx, o] of meshes.entries()) {
    const base = o.material.color.clone();
    const q = o.scale.x;             // escala da quantização: medidas em "unidades originais" são divididas por ela
    o.layers.disableAll();           // o original não aparece; os "clones" abaixo sim

    const edges = new EdgesGeometry(o.geometry, 25);

    // 0 · vidro
    add(o, new Mesh(o.geometry, glassMat), 0);
    add(o, new LineSegments(edges, glassEdge), 0);

    // 1 · glitter colorido
    const bright = base.clone(); bright.getHSL(hsl, SRGBColorSpace);
    bright.setHSL(hsl.h, Math.min(1, hsl.s * .85 + .1), /Centro/.test(o.name) ? .85 : .66, SRGBColorSpace);
    add(o, new Mesh(o.geometry, new MeshBasicMaterial({ color: base.clone().multiplyScalar(.05) })), 1);
    const count = Math.round(TOTAL * areas[idx] / totalArea);
    const pos = new Float32Array(count * 3), rnd = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      samplers[idx].sample(p, n);
      p.addScaledVector(n, 0.0006 / q);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      rnd[k] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aRnd', new BufferAttribute(rnd, 1));
    add(o, new Points(g, sparkMat(bright)), 1);
    add(o, new LineSegments(edges, new LineBasicMaterial({
      color: bright, transparent: true, opacity: .55, blending: AdditiveBlending, depthWrite: false,
    })), 1);

    // 2 · holograma
    add(o, new Mesh(o.geometry, holoMat), 2);
    add(o, new LineSegments(edges, holoDash(q)), 2).computeLineDistances();

    // 3 · cores originais, verniz brilhante
    add(o, new Mesh(o.geometry, new MeshPhysicalMaterial({
      color: base, roughness: .28, metalness: 0, clearcoat: 1, clearcoatRoughness: .08,
      emissive: base, emissiveIntensity: .08, envMapIntensity: 1.2,
    })), 3);

    await nextTask();
    if (disposed) return;
  }

  // compila os shaders de todas as cenas em segundo plano, para não engasgar ao chegar em cada uma
  for (let k = 0; k < N; k++) {
    camera.layers.set(k);
    await renderer.compileAsync(scene, camera, scene);
    if (disposed) return;
  }
  $loader.classList.add('done');
}

if (location.protocol === 'file:') {
  $loader.textContent = 'ABRA PELO SERVIDOR: http://localhost:5510/';
} else {
  buildModel().catch((err) => {
    console.error(err);
    $loader.textContent = 'ERRO AO CARREGAR O MODELO (assets/logo-3d.glb)';
  });
}

/* ============================================================
   COMPOSIÇÃO: linha de corte + brilho + partículas na borda
   ============================================================ */
const compMat = new ShaderMaterial({
  uniforms: {
    tA: { value: rtA.texture }, tB: { value: rtB.texture },
    uEdge: { value: -1 }, uSlope: { value: SLOPE }, uActive: { value: 0 },
    uAccent: { value: new Color() }, uTime, uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tA, tB; uniform float uEdge, uSlope, uActive, uTime, uAspect; uniform vec3 uAccent;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float sparkles(vec2 uv, float scale, float t){
      vec2 g = uv * vec2(scale * uAspect, scale);
      vec2 id = floor(g); vec2 f = fract(g) - 0.5;
      float r = hash(id);
      vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
      float d = length(f - o * 0.7);
      float sz = 0.05 + 0.13 * hash(id + 1.3);
      float tw = 0.5 + 0.5 * sin(t * (2.0 + r * 4.0) + r * 30.0);
      return smoothstep(sz, 0.0, d) * step(0.5, r) * tw;
    }
    void main(){
      vec4 a = texture2D(tA, vUv);
      vec3 col = a.rgb;
      if (uActive > 0.5) {
        float e = uEdge + uSlope * (vUv.x - 0.5) + 0.006 * sin(vUv.x * 9.0 + uTime * 0.8);
        float dy = vUv.y - e;                                  // > 0: cena antiga  |  < 0: cena nova
        vec3 b = texture2D(tB, vUv).rgb;
        vec3 old = a.rgb * (1.0 - 0.5 * exp(-max(dy, 0.0) * 14.0));   // sombra na cena que sai
        col = mix(old, b, smoothstep(0.0012, -0.0012, dy));
        col += uAccent * (exp(-abs(dy) * 160.0) * 1.4 + exp(-abs(dy) * 20.0) * 0.18);
        // partículas "soltando" da borda e subindo
        float band = smoothstep(0.26, 0.0, dy) * smoothstep(-0.025, 0.005, dy);
        vec2 su = vec2(vUv.x, dy - uTime * 0.025);
        float sp = sparkles(su, 95.0, uTime) + 0.8 * sparkles(su + 13.1, 170.0, uTime * 1.3) + 0.7 * sparkles(su + 5.7, 48.0, uTime * 0.8);
        col += mix(uAccent, vec3(1.0), 0.3) * sp * band * 2.4;
      }
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false, depthWrite: false,
});
const compScene = new Scene();
const compQuad = new Mesh(new PlaneGeometry(2, 2), compMat);
compQuad.frustumCulled = false; compScene.add(compQuad);
const compCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

/* ============================================================
   LAYOUT / RESIZE
   ============================================================ */
const layers = [...section.querySelectorAll('.t3d-layer')];
const inners = layers.map(l => l.querySelector('.t3d-inner'));
let W = 0, H = 0, top0 = 0;
function resize() {
  W = sticky.clientWidth; H = sticky.clientHeight;
  renderer.setSize(W, H, false);
  rtA.setSize(Math.round(W * PR), Math.round(H * PR));
  rtB.setSize(Math.round(W * PR), Math.round(H * PR));
  camera.aspect = W / H; camera.updateProjectionMatrix();
  const aspect = W / H;
  compMat.uniforms.uAspect.value = aspect;
  bgMats.forEach(m => m.uniforms.uAspect.value = aspect);
  pivot.scale.setScalar(aspect < 1 ? Math.max(.62, aspect * 1.05) : 1);
  pivot.position.y = aspect < 1 ? -0.55 : 0;
  // a seção fica "presa" na tela durante todas as transições
  // + 1 tela no fim: a dobra do método sobe por cima enquanto o 3D continua parado
  section.style.height = (H * (SEG * (N - 1) + 2)) + 'px';
  top0 = section.getBoundingClientRect().top + scrollY;   // ponto em que a dobra encosta no topo da tela
}
function setQuality(pr) {
  PR = pr; uPR.value = pr;
  renderer.setPixelRatio(pr);
  resize();
}
addEventListener('resize', resize, { passive: true });
cleanups.push(() => removeEventListener('resize', resize));
resize();
// se o hero mudar de altura (fontes/imagens carregando, celular), recalcula onde a dobra começa
const heroEl = document.querySelector('.hero');
if (heroEl) {
  const ro = new ResizeObserver(() => { top0 = section.getBoundingClientRect().top + scrollY; });
  ro.observe(heroEl);
  cleanups.push(() => ro.disconnect());
}

/* ============================================================
   INTERAÇÃO
   ============================================================ */
if (startP !== null) scrollTo({ top: top0 + +startP * H * SEG, behavior: 'instant' });
let smooth = scrollY - top0;          // rolagem relativa ao início da dobra 3D

// só renderiza quando a dobra está na tela
let visible = false;
const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px 0px' });
io.observe(section);
cleanups.push(() => io.disconnect());
let mx = 0, my = 0, tx = 0, ty = 0;
const onPointer = (e) => { tx = e.clientX / W - .5; ty = e.clientY / H - .5; };
addEventListener('pointermove', onPointer, { passive: true });
cleanups.push(() => removeEventListener('pointermove', onPointer));

const $num = $('t3d-num');
const $name = $('t3d-name');
const $bar = $('t3d-bar');
const $hint = $('t3d-hint');
const pad = n => String(n).padStart(2, '0');
const clamp01 = v => Math.min(1, Math.max(0, v));
const edgeAt = (base, x) => base + SLOPE * (x - .5);
const ease = (dt, speed) => 1 - Math.exp(-dt * speed);   // suavização igual em 60 Hz ou 144 Hz

// só mexe no DOM quando o valor muda
const lastClip = [], lastY = [];
let lastStage = -1, lastBar = '', lastHint = -1;

// monitor de desempenho: se a média passar de ~45 fps, baixa a resolução um degrau
let perfT = 0, perfN = 0;

let prev = performance.now();
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const raw = (now - prev) / 1000; prev = now;
  const dt = Math.min(raw, .05);
  uTime.value += dt;

  smooth += (scrollY - top0 - smooth) * ease(dt, 9);
  if (!visible) return;
  if (scrollY - top0 > H * (SEG * (N - 1) + 1) + 2) return;   // já coberto pela dobra do método
  mx += (tx - mx) * ease(dt, 3);
  my += (ty - my) * ease(dt, 3);

  if (raw < .1) { perfT += raw; perfN++; }
  if (perfN >= 90) {
    if (perfT / perfN > 1 / 45 && PR > PR_MIN + .01) setQuality(Math.max(PR_MIN, PR * .8));
    perfT = 0; perfN = 0;
  }

  // p: posição em "trechos" (0 … N-1)
  const p = Math.min(N - 1, Math.max(0, smooth / (H * SEG)));
  const i = Math.min(Math.floor(p), N - 2);
  const local = p - i;
  const f = p >= N - 1 ? 1 : clamp01((local - HOLD) / (1 - 2 * HOLD));
  const edge = MathUtils.lerp(-0.2, 1.2, f);  // o corte acompanha o scroll 1:1

  // giro: uma volta durante cada corte (de frente nas pausas) + respiração leve
  const turn = f * f * (3 - 2 * f);
  const enter = Math.min(0, Math.max(-1, smooth / H));      // -1 → 0 enquanto a dobra sobe na tela
  spin.rotation.y = (i + turn) * TURN + enter * Math.PI * .6 + Math.sin(uTime.value * .4) * .08;
  spin.rotation.x = Math.sin(turn * Math.PI) * .32 + Math.sin(uTime.value * .3) * .04;   // inclina um pouco no meio do giro
  pivot.rotation.y = mx * .35;
  pivot.rotation.x = my * .25;

  // render das cenas (a segunda só existe durante o corte)
  const transitioning = f > 0 && f < 1;
  const a = f >= 1 ? i + 1 : i;
  camera.layers.set(a);
  renderer.setRenderTarget(rtA); renderer.render(scene, camera);
  if (transitioning) {
    camera.layers.set(i + 1);
    renderer.setRenderTarget(rtB); renderer.render(scene, camera);
    compMat.uniforms.uAccent.value.set(STAGES[i + 1].accent);
  }
  compMat.uniforms.uActive.value = transitioning ? 1 : 0;
  compMat.uniforms.uEdge.value = edge;
  renderer.setRenderTarget(null);
  renderer.render(compScene, compCam);

  // texto: mesmas regras de recorte da linha
  const L = ((1 - edgeAt(edge, 0)) * 100).toFixed(2), R = ((1 - edgeAt(edge, 1)) * 100).toFixed(2);
  for (let k = 0; k < N; k++) {
    let clip = 'hidden', y = 0;
    if (!transitioning && k === a) clip = 'none';
    else if (transitioning && k === i)     { clip = `polygon(0 0, 100% 0, 100% ${R}%, 0 ${L}%)`;  y = -f * SHIFT; }
    else if (transitioning && k === i + 1) { clip = `polygon(0 ${L}%, 100% ${R}%, 100% 100%, 0 100%)`; y = (1 - f) * SHIFT; }
    if (clip !== lastClip[k]) {
      layers[k].style.visibility = clip === 'hidden' ? 'hidden' : 'visible';
      layers[k].style.clipPath = clip === 'hidden' ? '' : clip;
      lastClip[k] = clip;
    }
    const ys = y.toFixed(2);
    if (ys !== lastY[k]) { inners[k].style.transform = `translate3d(0, ${ys}vh, 0)`; lastY[k] = ys; }
  }

  // HUD
  const cur = f > .5 ? i + 1 : i;
  if (cur !== lastStage) { $num.textContent = `${pad(cur + 1)} / ${pad(N)}`; $name.textContent = STAGES[cur].name; lastStage = cur; }
  const bar = `scaleX(${(p / (N - 1)).toFixed(3)})`;
  if (bar !== lastBar) { $bar.style.transform = bar; lastBar = bar; }
  const hint = p > .05 ? 0 : 1;
  if (hint !== lastHint) { $hint.style.opacity = hint; lastHint = hint; }
}
rafId = requestAnimationFrame(frame);

return () => {
  disposed = true;
  cancelAnimationFrame(rafId);
  cleanups.forEach((fn) => fn());
  scene.traverse((o) => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach((m) => m.dispose());
  });
  rtA.dispose(); rtB.dispose(); pmrem.dispose();
  renderer.dispose();
};
}
