import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import '../styles/bastidores.css';

gsap.registerPlugin(Draggable);

const WA = 'https://wa.me/5541997135842';
const v = (f) => `${import.meta.env.BASE_URL}videos/${f}`;

// Palavras que aparecem na tela do vídeo, com o tempo (s) em que entram e saem.
// Elas "escapam" do vídeo e são impressas na mesa, sincronizadas com a reprodução.
const WORDS = [
  [4.0, 4.5, 'Comunicação', '#00a0e3'],
  [4.5, 6.2, 'Impacto', '#e5007e'],
  [7.5, 9.3, 'Conexão', '#7ac143'],
  [9.5, 10, 'Pensar', '#1e5bb8'],
  [10, 10.5, 'Olhar', '#f39200'],
  [10.5, 11.5, 'Analisar', '#e30613'],
  [11.5, 12.5, 'Refletir', '#00a0e3'],
  [12.5, 14, 'Perceber', '#e5007e'],
  [17, 18, 'Comunicação', '#1e5bb8'],
  [18, 19.6, 'Consciente', '#7ac143'],
  [21, 22, 'Poderosa', '#f39200'],
  [22, 27.6, 'Únicos', '#e30613'],
  [28.5, 30, 'Mundo mental', '#00a0e3'],
  [30, 31, 'Realize', '#e5007e'],
  [31, 32, 'Human', '#1e5bb8'],
  [32, 33, 'Pessoas', '#7ac143'],
  [33, 34, 'Relações', '#f39200'],
  [34, 35, 'Consciência', '#e30613'],
  [35, 36.6, 'Conexão', '#00a0e3'],
  [39.5, 40.6, 'Resultado', '#e5007e'],
];
const wordAt = (t) => WORDS.findIndex(([a, b]) => t >= a && t < b);

const PHOTOS = [
  { key: 'ladoALado', cls: 'bs-i1', caption: 'lado a lado', alt: 'Dupla da Realize Human em frente ao prédio, com o logo colorido ao fundo' },
  { key: 'palestra', cls: 'bs-i2', caption: 'dizer em voz alta', alt: 'Apresentação da Realize Human para uma plateia de líderes' },
  { key: 'posicao', cls: 'bs-i3', caption: 'posição firme', alt: 'Dupla da Realize Human de braços cruzados no escritório' },
  { key: 'reuniao', cls: 'bs-i4', caption: 'método, não achismo', alt: 'Dupla da Realize Human analisando gráficos numa reunião' },
];

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Pic({ img, alt }) {
  return (
    <picture>
      <source type="image/avif" srcset={img.avif} sizes={img.sizes} />
      <img src={img.src} srcset={img.webp} sizes={img.sizes} alt={alt} width="1122" height="1402" loading="lazy" decoding="async" draggable={false} />
    </picture>
  );
}

/**
 * 5ª dobra — "Bastidores".
 * Depois do palco escuro, a luz da sala acende sobre uma mesa de trabalho: as fotos caem
 * como polaroides, o vídeo da Jornada toca mudo como a foto principal e as palavras que
 * aparecem nele são "impressas" em tinta sobre a mesa, no mesmo instante.
 * No desktop dá para arrastar as fotos; clicar no vídeo abre com som.
 */
export default function Bastidores({ images }) {
  const root = useRef(null);
  const mini = useRef(null);
  const dlg = useRef(null);
  const full = useRef(null);
  const wordEl = useRef(null);
  const rec = useRef(null);
  const dragged = useRef(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const sec = root.current;
    const vid = mini.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const q = gsap.utils.selector(sec);
    const off = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); off.push(() => el.removeEventListener(ev, fn, opt)); };
    let visible = false, entered = reduce, cur = -1;

    /* ---------- palavras: troca a palavra impressa conforme o tempo do vídeo ---------- */
    const showWord = (i) => {
      if (i === cur) return;
      cur = i;
      const el = wordEl.current;
      gsap.killTweensOf(el.children);
      const old = [...el.children];
      const swap = () => {
        el.replaceChildren();
        if (i < 0) return;
        const [, , text, color] = WORDS[i];
        el.style.setProperty('--wc', color);
        el.style.setProperty('--n', Math.max(text.length, 6));
        el.setAttribute('data-word', text);
        for (const ch of text) {
          const s = document.createElement('span');
          s.textContent = ch === ' ' ? ' ' : ch;
          el.append(s);
        }
        if (!reduce) gsap.fromTo(el.children, { yPercent: 105 }, { yPercent: 0, duration: 0.45, ease: 'power4.out', stagger: 0.025 });
      };
      if (reduce || !old.length) return swap();
      // a palavra anterior sai para cima rapidinho — power2.in: começa lenta e acelera ao sair
      gsap.to(old, { yPercent: -105, duration: 0.18, ease: 'power2.in', stagger: 0.01, onComplete: swap });
    };
    on(vid, 'timeupdate', () => {
      rec.current.textContent = `REC ${fmt(vid.currentTime)} / 00:46`;
      showWord(wordAt(vid.currentTime));
    });

    /* ---------- vídeo mudo: só baixa perto da tela, só toca quando visível ---------- */
    const tryPlay = () => { if (visible && entered && !dlg.current.open) vid.play().catch(() => {}); };
    const near = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !vid.src) { vid.src = vid.dataset.src; near.disconnect(); }
    }, { rootMargin: '100% 0px' });
    near.observe(sec);
    const vis = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce) tryPlay(); else vid.pause();
    }, { threshold: 0.2 });
    vis.observe(vid);
    off.push(() => { near.disconnect(); vis.disconnect(); });

    const ctx = gsap.context(() => {
      if (reduce) return;
      const items = q('.bs-item');
      const mesa = q('.bs-mesa')[0];

      // A lâmpada só "apaga" a seção se o JS rodou — sem JS a mesa já aparece acesa.
      sec.classList.add('is-armed');
      gsap.set(q('.bs-title .ln > span'), { yPercent: 110 });
      gsap.set(q('[data-bs-in]'), { autoAlpha: 0, y: 18 });

      // Monte de fotos no centro da mesa: cada uma sai daí até o seu lugar ("distribuir cartas").
      const pile = (el) => {
        const m = mesa.getBoundingClientRect(), r = el.getBoundingClientRect();
        return { x: m.left + m.width / 2 - (r.left + r.width / 2), y: m.top + m.height * 0.55 - (r.top + r.height / 2) };
      };

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl
        // 1 · Luz acende com duas piscadas, como lâmpada fluorescente. steps/linear: sem curva, é elétrico.
        .to(q('.bs-lamp'), { keyframes: { opacity: [1, 0.25, 0.85, 0.1, 0.6, 0] }, duration: 0.7, ease: 'none' })
        // 2 · Título: power4.out, mesma assinatura das outras dobras.
        .to(q('.bs-title .ln > span'), { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09 }, '-=0.15')
        .to(q('[data-bs-in]'), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07 }, '-=0.75')
        // 3 · Fotos saem do monte. expo.out: arranca rápido e "pousa" devagar na mesa, com peso de papel.
        .fromTo(items.filter((el) => !el.classList.contains('bs-film')),
          { x: (i, el) => pile(el).x, y: (i, el) => pile(el).y, rotation: () => gsap.utils.random(-25, 25), scale: 0.7, autoAlpha: 0 },
          { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 1.15, ease: 'expo.out', stagger: 0.11 }, '-=0.9')
        // 4 · O vídeo cai por último, por cima, com flash de câmera.
        .fromTo(q('.bs-film'), { y: -60, rotation: -8, scale: 1.12, autoAlpha: 0 },
          { y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.9, ease: 'back.out(1.4)' }, '-=0.6')
        .fromTo(q('.bs-flash'), { opacity: 0 }, { keyframes: { opacity: [0, 0.9, 0] }, duration: 0.5, ease: 'power1.out' }, '<0.25')
        .add(() => { entered = true; tryPlay(); }, '<');

      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { tl.play(); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(sec);
      off.push(() => io.disconnect());

      /* ---------- arrastar as fotos (só mouse, tela larga) ---------- */
      const mm = gsap.matchMedia();
      off.push(() => mm.revert());
      mm.add('(pointer: fine) and (min-width: 901px)', () => {
        let z = 10;
        const drags = Draggable.create(items, {
          bounds: sec,
          zIndexBoost: false,
          minimumMovement: 4,
          dragClickables: true,   // o vídeo é um <button>: também precisa ser arrastável
          onPress() {
            this.target.style.zIndex = ++z;
            gsap.to(this.target, { scale: 1.04, rotation: gsap.utils.random(-3, 3), duration: 0.25, ease: 'power2.out' });
            this.target.classList.add('is-lifted');
          },
          onRelease() {
            // solta: volta ao tamanho com um quique pequeno, como papel caindo na mesa
            gsap.to(this.target, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' });
            this.target.classList.remove('is-lifted');
          },
          onDragStart: () => { dragged.current = true; setMoved(true); },
          // o clique que vem logo depois de soltar não deve abrir o vídeo
          onDragEnd: () => setTimeout(() => { dragged.current = false; }, 0),
        });
        return () => drags.forEach((d) => d.kill());
      });
    }, sec);

    return () => { off.forEach((fn) => fn()); ctx.revert(); };
  }, []);

  /* ================= vídeo com som ================= */
  function openFull() {
    const d = dlg.current, el = full.current, m = mini.current;
    if (d.open) return;
    m.pause();
    if (!el.src) el.src = el.dataset.src;
    el.currentTime = m.currentTime || 0;   // continua de onde a mesa estava
    el.muted = false;
    d.showModal();
    window.__lenis?.stop();
    el.play().catch(() => {});
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(d.querySelector('.bs-dlg-frame'), { scale: 0.86, autoAlpha: 0, rotation: -3 },
        { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.7, ease: 'expo.out' });
    }
  }
  function closeFull() {
    const d = dlg.current, el = full.current, m = mini.current;
    if (!d.open) return;
    el.pause();
    if (el.currentTime) m.currentTime = el.currentTime;
    d.close();
    window.__lenis?.start();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) m.play().catch(() => {});
  }
  useEffect(() => {
    const d = dlg.current;
    const onCancel = (e) => { e.preventDefault(); closeFull(); };
    const onClick = (e) => { if (e.target === d) closeFull(); };
    d.addEventListener('cancel', onCancel);
    d.addEventListener('click', onClick);
    return () => { d.removeEventListener('cancel', onCancel); d.removeEventListener('click', onClick); };
  }, []);

  const onFilmClick = () => { if (!dragged.current) openFull(); };

  const tidy = () => {
    gsap.to(root.current.querySelectorAll('.bs-item'), { x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'expo.inOut', stagger: 0.05 });
    setMoved(false);
  };

  return (
    <section class="bs" id="bastidores" ref={root} aria-labelledby="bs-title">
      <div class="bs-lamp" aria-hidden="true" />

      <div class="bs-copy">
        <span class="bs-kicker" data-bs-in>05 — Bastidores</span>
        <h2 class="bs-title" id="bs-title">
          <span class="ln"><span>Por trás</span></span>
          <span class="ln"><span>do método,</span></span>
          <span class="ln"><span><em>pessoas</em>.</span></span>
        </h2>
        <p class="bs-lead" data-bs-in>
          A Realize Human ajuda empresas a tomarem decisões mais inteligentes sobre pessoas,
          liderança, cultura, recrutamento e desenvolvimento humano.
        </p>
        <p class="bs-lead" data-bs-in>
          O método sai da sala de reunião, sobe ao palco e volta para o dia a dia de quem lidera —
          sempre com gente olhando para gente.
        </p>
        <p class="bs-stamp" data-bs-in>
          <span>Comunicação consciente</span><i aria-hidden="true">·</i><span>Relações humanas</span>
        </p>
        <a class="bs-cta" data-bs-in href={WA} target="_blank" rel="noopener noreferrer">
          Converse com quem faz
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </a>
        <p class="bs-hint" data-bs-in>
          <span class="hint-mouse">Arraste as fotos · clique no vídeo para ouvir</span>
          <span class="hint-touch">Toque no vídeo para assistir com som</span>
          {moved && <button type="button" class="bs-tidy" onClick={tidy}>Arrumar a mesa</button>}
        </p>
      </div>

      <div class="bs-mesa">
        {PHOTOS.map((p) => (
          <figure class={`bs-item ${p.cls}`} key={p.key}>
            <div class="bs-print">
              <Pic img={images[p.key]} alt={p.alt} />
              <figcaption>{p.caption}</figcaption>
            </div>
          </figure>
        ))}

        <figure class="bs-item bs-film bs-i5">
          <div class="bs-print">
            <button type="button" class="bs-screen" onClick={onFilmClick}
              aria-label="Assistir com som: Realize Human na 6ª Jornada Farmacêutica (0:46)">
              <img src={v('bastidores.webp')} alt="" width="540" height="960" loading="lazy" decoding="async" draggable={false} />
              <video ref={mini} data-src={v('bastidores-mudo.mp4')} muted playsinline loop preload="none" aria-hidden="true" />
              <span class="bs-rec" aria-hidden="true"><i /><span ref={rec}>REC 00:00 / 00:46</span></span>
              <span class="bs-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
                ouvir
              </span>
            </button>
            <figcaption>6ª Jornada Farmacêutica</figcaption>
          </div>
        </figure>

        {/* palavra do vídeo "impressa" em tinta sobre a mesa */}
        <div class="bs-ink" aria-hidden="true"><span class="bs-word" ref={wordEl} /></div>
        <div class="bs-flash" aria-hidden="true" />
      </div>

      <dialog class="bs-dlg" ref={dlg} aria-label="Vídeo: Realize Human na 6ª Jornada Farmacêutica" data-lenis-prevent>
        <figure class="bs-dlg-frame">
          <video ref={full} data-src={v('bastidores.mp4')} poster={v('bastidores.webp')} controls playsinline preload="none" />
          <figcaption>Realize Human · 6ª Jornada Farmacêutica</figcaption>
        </figure>
        <button class="bs-close" type="button" onClick={closeFull} aria-label="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </dialog>
    </section>
  );
}
