import gsap from 'gsap';
import { getModelBuffer } from './model-buffer.js';

/*
  Tela de carregamento.
  Baixa o que a página precisa (imagens do hero, fontes, three.js e o modelo 3D),
  mostra o progresso REAL montando o logo peça por peça, e sai com uma cortina em curva.
  Ao sair, avisa o resto do site (classe `site-go` + evento `site:go`) para o hero entrar.
*/

const html = document.documentElement;
const root = document.getElementById('preloader');

if (root) run();

function run() {
  const canvas = root.querySelector('#pl-canvas');
  const $num = root.querySelector('#pl-num');
  const $bar = root.querySelector('#pl-bar');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 2ª visita na mesma sessão: tudo já está em cache, então a tela é curtinha
  let returning = false;
  try { returning = sessionStorage.getItem('rh-loaded') === '1'; } catch {}
  const MIN_MS = reduce ? 300 : returning ? 500 : 1500;   // tempo mínimo para a montagem ser vista
  const MAX_MS = 9000;                                     // nunca prende a pessoa mais que isso
  const t0 = performance.now();

  /* ---------------- o que estamos carregando (pesos somam 1) ---------------- */
  const parts = { model: 0, three: 0, images: 0, fonts: 0 };
  const weight = { model: 0.45, three: 0.2, images: 0.25, fonts: 0.1 };
  const real = () => Object.keys(parts).reduce((sum, k) => sum + parts[k] * weight[k], 0);

  const model = getModelBuffer((p) => { parts.model = p; });
  const sceneModule = import('./preloader-scene.js').then((m) => { parts.three = 1; return m; });

  // imagens: as do hero (a versão que o navegador escolheu no srcset) + os bonequinhos do método
  const imgs = [...document.querySelectorAll('.hero img, .metodo img')];
  let doneImgs = 0;
  const images = Promise.all(imgs.map((img) => {
    img.loading = 'eager';
    const ready = img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    return ready.then(() => img.decode?.().catch(() => {})).then(() => { parts.images = ++doneImgs / imgs.length; });
  }));
  if (!imgs.length) parts.images = 1;

  const fonts = (document.fonts?.ready ?? Promise.resolve()).then(() => { parts.fonts = 1; });

  // a cena 3D da tela de carregamento entra assim que three.js + modelo chegam
  let scene = null;
  Promise.all([sceneModule, model])
    .then(([m, buf]) => m.createLoaderScene(canvas, buf))
    .then((s) => { scene = s; root.classList.add('has-3d'); })
    .catch(() => {});   // sem WebGL: a tela funciona só com o contador

  let allDone = false;
  Promise.allSettled([model, sceneModule, images, fonts]).then(() => {
    Object.keys(parts).forEach((k) => { parts[k] = 1; });
    allDone = true;
  });

  /* ---------------- loop do contador ---------------- */
  let shown = 0, prev = t0, raf = 0, leaving = false;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - prev) / 1000, 0.05); prev = now;
    const elapsed = now - t0;
    // o número anda suave atrás do progresso real e nunca mais rápido que o tempo mínimo
    const target = Math.min(real(), elapsed / MIN_MS);
    shown += (target - shown) * (1 - Math.exp(-dt * 6));
    if (allDone && target >= 1 && shown > 0.995) shown = 1;
    if (elapsed > MAX_MS) shown = 1;

    const pct = Math.round(shown * 100);
    $num.textContent = pct;
    root.setAttribute('aria-valuenow', pct);
    $bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    scene?.setProgress(shown);

    if (shown === 1 && !leaving) { leaving = true; leave(); }
  }
  raf = requestAnimationFrame(tick);

  /* ---------------- saída ---------------- */
  function go() {
    // libera o hero: classe para quem hidratar depois, evento para quem já está ouvindo
    html.classList.add('site-go');
    window.dispatchEvent(new Event('site:go'));
  }

  function finish() {
    cancelAnimationFrame(raf);
    scene?.dispose();
    root.remove();
    html.classList.remove('is-loading');
    html.classList.add('site-ready');
    try { sessionStorage.setItem('rh-loaded', '1'); } catch {}
  }

  function leave() {
    html.classList.remove('is-loading');   // já libera o scroll enquanto a cortina sobe

    if (reduce) {
      go();
      gsap.to(root, { autoAlpha: 0, duration: 0.4, onComplete: finish });
      return;
    }

    const curtain = { c: 0 };
    const setClip = () => {
      const w = innerWidth, h = innerHeight, c = curtain.c;
      const edge = h * (1 - c);                        // a borda de baixo sobe até o topo
      const bulge = Math.sin(c * Math.PI) * h * 0.2;   // curva aparece no meio e achata no fim
      root.style.clipPath = `path('M0 0 L${w} 0 L${w} ${edge.toFixed(1)} Q${w / 2} ${(edge + bulge).toFixed(1)} 0 ${edge.toFixed(1)} Z')`;
    };
    const exit = { k: 0 };

    gsap.timeline({ onComplete: finish })
      // 1 · logo dá um giro completo e se recolhe. power3.inOut: arranca e freia suave,
      //     o giro "pesa" no meio e termina parado.
      .to(exit, { k: 1, duration: returning ? 0.6 : 1.0, ease: 'power3.inOut', onUpdate: () => scene?.exit(exit.k) })
      // 2 · contador e textos saem para cima junto com o giro
      .to(root.querySelectorAll('.pl-ui'), { y: -24, autoAlpha: 0, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, '<0.15')
      // 3 · cortina com a borda de baixo em curva sobe revelando a home.
      //     expo.inOut: lenta para começar, rápida no meio, assenta devagar — como um pano pesado.
      .to(curtain, { c: 1, duration: returning ? 0.75 : 1.05, ease: 'expo.inOut', onUpdate: setClip, onStart: setClip }, '-=0.35')
      // o hero começa a entrar logo que a cortina descola (overlap com a revelação)
      .add(go, '<0.12');
  }
}
