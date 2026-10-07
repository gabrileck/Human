import gsap from 'gsap';

/*
  Tela de carregamento.
  Espera só o que aparece na primeira tela (imagens da 1ª dobra e fontes), mostra o progresso
  REAL montando o logo peça por peça e sai com uma cortina em curva. O resto (modelo 3D, imagens
  das dobras de baixo) é baixado depois, sem atrasar a abertura.

  Sem WebGL aqui: as 17 peças são imagens renderizadas a partir do próprio modelo 3D
  (mesma luz e verniz) e animadas só com transform/opacity — a placa de vídeo compõe tudo e a
  thread principal fica livre. (Antes, o three.js rodando nesta tela era o maior custo da página.)
  Ao sair, avisa o resto do site (classe `site-go` + evento `site:go`) para o hero entrar.
*/

const html = document.documentElement;
const root = document.getElementById('preloader');

if (root) run();

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeOutBack = (t, s = 1.5) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;   // passa do ponto e volta: "encaixe"
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function run() {
  const $num = root.querySelector('#pl-num');
  const $bar = root.querySelector('#pl-bar');
  const logo = root.querySelector('#pl-logo');
  const curve = root.querySelector('.pl-curve');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 2ª visita na mesma sessão: tudo já está em cache, então a tela é curtinha
  let returning = false;
  try { returning = sessionStorage.getItem('rh-loaded') === '1'; } catch {}
  const MIN_MS = reduce ? 300 : returning ? 500 : 1500;   // tempo mínimo para a montagem ser vista
  const MAX_MS = 9000;                                     // nunca prende a pessoa mais que isso
  const t0 = performance.now();

  /* ---------------- peças do logo: posição/rotação de partida espalhadas ---------------- */
  const WINDOW = 0.42;   // fatia do progresso que cada peça leva para encaixar
  const pieces = [...logo.querySelectorAll('.pl-piece')].map((el) => {
    const a = +el.dataset.angle, center = el.dataset.center === '1';
    const r = (lo, hi) => lo + Math.random() * (hi - lo);
    return {
      el, center, disc: el.dataset.disc === '1', angle: a,
      // vem de fora para dentro, na direção da própria posição no círculo
      fx: center ? 0 : Math.cos(a) * r(0.55, 0.8), fy: center ? 0 : Math.sin(a) * r(0.55, 0.8),
      fs: center ? 2.4 : r(0.55, 1.35),                  // "profundidade": maior = mais perto
      rx: r(-75, 75), ry: r(-75, 75), rz: r(-140, 140),
      last: '',
    };
  });
  // ordem de encaixe: corpos em volta do círculo, depois as cabeças, por fim o centro
  pieces.sort((p, q) => (p.center - q.center) || (p.disc - q.disc) || (p.angle - q.angle));
  pieces.forEach((p, i) => { p.start = (i / (pieces.length - 1)) * (1 - WINDOW); });

  // O deslocamento das peças é em múltiplos de --L (o lado do logo, definido no CSS): assim o JS
  // não lê nenhuma medida (offsetWidth, innerWidth...), o que forçaria o navegador a calcular o
  // layout da página inteira antes da hora (reflow forçado). Redimensionar a janela já funciona.

  /* ---------------- o que estamos carregando (pesos somam 1) ---------------- */
  const parts = { images: 0, fonts: 0 };
  const weight = { images: 0.8, fonts: 0.2 };
  const real = () => Object.keys(parts).reduce((sum, k) => sum + parts[k] * weight[k], 0);

  // imagens: peças do logo e hero (a versão que o navegador escolheu no srcset), já decodificadas
  const imgs = [...document.querySelectorAll('.pl-piece, .hero img')];
  let doneImgs = 0;
  const images = Promise.all(imgs.map((img) => {
    img.loading = 'eager';
    const ready = img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    return ready.then(() => img.decode?.().catch(() => {})).then(() => { parts.images = ++doneImgs / imgs.length; });
  }));
  if (!imgs.length) parts.images = 1;

  const fonts = (document.fonts?.ready ?? Promise.resolve()).then(() => { parts.fonts = 1; });

  let allDone = false;
  Promise.allSettled([images, fonts]).then(() => {
    Object.keys(parts).forEach((k) => { parts[k] = 1; });
    allDone = true;
  });

  /* ---------------- montagem do logo (só transform/opacity) ---------------- */
  let exitK = 0, time = 0;
  function drawLogo(progress, dt) {
    time += dt;
    for (const p of pieces) {
      const t = clamp01((progress - p.start) / WINDOW);
      const m = 1 - easeOutBack(t);          // 1 = longe/girando · 0 = encaixada
      const rot = 1 - easeOutCubic(t);
      const op = clamp01(t * 3);
      const v = `translate3d(calc(var(--L) * ${(p.fx * m).toFixed(4)}), calc(var(--L) * ${(p.fy * m).toFixed(4)}), 0) `
        + `rotateX(${(p.rx * rot).toFixed(1)}deg) rotateY(${(p.ry * rot).toFixed(1)}deg) rotateZ(${(p.rz * rot).toFixed(1)}deg) `
        + `scale(${(1 + (p.fs - 1) * m).toFixed(3)})|${op.toFixed(2)}`;
      if (v !== p.last) {
        const [tf, o] = v.split('|');
        p.el.style.transform = tf; p.el.style.opacity = o; p.last = v;
      }
    }
    // enquanto monta, o conjunto gira devagar; montado, só "respira"; na saída dá uma volta
    const e = easeInOut(exitK);
    const ry = (1 - easeOutCubic(progress)) * 38 + Math.sin(time * 0.8) * 5 + e * 360;
    const rx = (1 - progress) * 14 + Math.sin(time * 0.6) * 2.5;
    logo.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${(1 - e * 0.22).toFixed(3)})`;
    logo.style.opacity = (1 - exitK * exitK).toFixed(3);
  }

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
    if ($num.textContent !== String(pct)) { $num.textContent = pct; root.setAttribute('aria-valuenow', pct); }
    $bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    drawLogo(reduce ? 1 : shown, dt);

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
    root.remove();
    html.classList.remove('is-loading');
    html.classList.add('site-ready');
    try { sessionStorage.setItem('rh-loaded', '1'); } catch {}
    warmBelow();
  }

  // Depois da abertura, com a thread livre: baixa e decodifica as imagens das dobras de baixo
  // (bonequinhos do método, capas dos vídeos), para não pesarem na hora da rolagem.
  function warmBelow() {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    idle(() => {
      document.querySelectorAll('.metodo img, .palco img').forEach((img) => {
        img.loading = 'eager';
        img.decode?.().catch(() => {});
      });
    }, { timeout: 2000 });
  }

  function leave() {
    html.classList.remove('is-loading');   // já libera o scroll enquanto a cortina sobe

    if (reduce) {
      go();
      gsap.to(root, { autoAlpha: 0, duration: 0.4, onComplete: finish });
      return;
    }

    // Cortina: a tela sobe (translateY) e a curva da borda de baixo cresce e achata (scaleY).
    // Só transform → a placa de vídeo compõe, nada é repintado durante a saída.
    const curtain = { c: 0 };
    const setCurtain = () => {
      const c = curtain.c;
      root.style.transform = `translate3d(0, ${(-c * 100).toFixed(3)}%, 0)`;
      curve.style.transform = `scaleY(${Math.sin(c * Math.PI).toFixed(4)})`;
    };
    const exit = { k: 0 };

    gsap.timeline({ onComplete: finish })
      // 1 · logo dá um giro completo e se recolhe. power3.inOut: arranca e freia suave.
      .to(exit, { k: 1, duration: returning ? 0.6 : 1.0, ease: 'power3.inOut', onUpdate: () => { exitK = exit.k; } })
      // 2 · contador e textos saem para cima junto com o giro
      .to(root.querySelectorAll('.pl-ui'), { y: -24, autoAlpha: 0, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, '<0.15')
      // 3 · cortina com a borda de baixo em curva sobe revelando a home.
      //     expo.inOut: lenta para começar, rápida no meio, assenta devagar — como um pano pesado.
      .to(curtain, { c: 1, duration: returning ? 0.75 : 1.05, ease: 'expo.inOut', onUpdate: setCurtain, onStart: setCurtain }, '-=0.35')
      // o hero começa a entrar logo que a cortina descola (overlap com a revelação)
      .add(go, '<0.12');
  }
}
