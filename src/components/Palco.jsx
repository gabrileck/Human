import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import '../styles/palco.css';

const WA = 'https://wa.me/5541997135842';
const base = import.meta.env.BASE_URL;
const v = (f) => `${base}videos/${f}`;

// Recortes da 6ª Jornada Farmacêutica (Realize Human × Grupo SPN)
const VIDEOS = [
  {
    tag: 'Bastidores', color: '#ff4f8c', dur: '0:40',
    title: 'Comunicação que transforma relações', who: 'Realize Human × Grupo SPN',
    poster: v('palco-1.webp'), preview: v('palco-1-previa.mp4'), full: v('palco-1.mp4'),
  },
  {
    tag: 'Palestra', color: '#00b8f0', dur: '0:36',
    title: 'Por que você trava na hora de falar?', who: 'Gisele Novaes',
    poster: v('palco-2.webp'), preview: v('palco-2-previa.mp4'), full: v('palco-2.mp4'),
  },
  {
    tag: 'Comunicação', color: '#00c97a', dur: '0:40',
    title: 'Você só fala — ou se comunica?', who: 'Gisele Novaes',
    poster: v('palco-comunicacao.webp'), preview: v('palco-comunicacao-previa.mp4'), full: v('palco-comunicacao.mp4'),
  },
];

const Icon = {
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.2" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.2" /></svg>,
  prev: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>,
  next: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>,
  sound: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>,
  mute: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m22 9-6 6M16 9l6 6" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>,
};

/**
 * 4ª dobra — "No palco".
 * Galeria de vídeos limpa: três vídeos verticais lado a lado, sem nada se mexendo sozinho.
 * Passar o mouse toca a prévia muda (com uma barra fina de progresso); clicar abre o
 * "modo palco" com som. No celular, a fileira desliza e a prévia toca no card em foco.
 */
export default function Palco() {
  const root = useRef(null);
  const dlg = useRef(null);
  const frame = useRef(null);
  const full = useRef(null);
  const bar = useRef(null);
  const openFrom = useRef(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  /* ================= prévias + entrada ================= */
  useEffect(() => {
    const sec = root.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;
    const q = gsap.utils.selector(sec);
    const off = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); off.push(() => el.removeEventListener(ev, fn, opt)); };

    const cards = q('.v-card').map((card) => ({ card, video: card.querySelector('video'), fill: card.querySelector('.v-progress i'), raf: 0 }));

    // barra de progresso da prévia: só roda enquanto a prévia toca
    const track = (it) => {
      const step = () => {
        const vv = it.video;
        if (vv.duration) it.fill.style.transform = `scaleX(${(vv.currentTime / vv.duration).toFixed(4)})`;
        it.raf = requestAnimationFrame(step);
      };
      it.raf = requestAnimationFrame(step);
    };
    const play = (it) => {
      if (dlg.current?.open) return;
      const vv = it.video;
      if (!vv.src) vv.src = vv.dataset.src;   // só baixa a prévia quando for usada
      vv.play().then(() => { it.card.classList.add('is-playing'); cancelAnimationFrame(it.raf); track(it); }).catch(() => {});
    };
    const stop = (it) => {
      it.video.pause();
      it.card.classList.remove('is-playing');
      cancelAnimationFrame(it.raf);
      it.raf = 0;
    };

    if (fine) {
      cards.forEach((it) => {
        on(it.card, 'pointerenter', () => play(it));
        on(it.card, 'pointerleave', () => stop(it));
        on(it.card, 'focus', () => play(it));
        on(it.card, 'blur', () => stop(it));
      });
    } else {
      // toque: toca a prévia do card que está em foco na fileira
      const vio = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const it = cards.find((x) => x.card === en.target);
          if (en.intersectionRatio > 0.7) play(it); else stop(it);
        });
      }, { threshold: [0, 0.7] });
      cards.forEach((it) => vio.observe(it.card));
      off.push(() => vio.disconnect());
    }

    /* ---------- entrada discreta: título sobe, textos e vídeos aparecem em sequência ---------- */
    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap.set(q('.palco-title .ln > span'), { yPercent: 110 });
      gsap.set(q('[data-palco-in]'), { autoAlpha: 0, y: 18 });
      gsap.set(q('.v-grid > li'), { autoAlpha: 0, y: 40 });

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl
        // power4.out: o título sobe rápido e para firme (mesma assinatura das outras dobras)
        .to(q('.palco-title .ln > span'), { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09 })
        .to(q('[data-palco-in]'), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07 }, '-=0.7')
        // vídeos: sobem e assentam, um depois do outro, sem quique
        .to(q('.v-grid > li'), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12 }, '<0.1');

      const sio = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { tl.play(); sio.disconnect(); }
      }, { threshold: 0.25 });
      sio.observe(sec);
      off.push(() => sio.disconnect());
    }, sec);

    return () => { cards.forEach((it) => cancelAnimationFrame(it.raf)); off.forEach((fn) => fn()); ctx.revert(); };
  }, []);

  /* ================= modo palco ================= */
  const vid = () => full.current;

  function load(i, autoplay = true) {
    setIdx(i);
    const el = vid();
    el.src = VIDEOS[i].full;
    el.muted = muted;
    if (bar.current) bar.current.value = 0;
    if (autoplay) el.play().then(() => setPaused(false)).catch(() => setPaused(true));
  }

  function open(i, e) {
    const d = dlg.current;
    // pausa as prévias
    root.current.querySelectorAll('.v-card video').forEach((x) => x.pause());
    root.current.querySelectorAll('.v-card.is-playing').forEach((x) => x.classList.remove('is-playing'));
    openFrom.current = e.currentTarget;
    load(i);                    // play() ainda dentro do clique: o navegador libera o som
    d.showModal();
    window.__lenis?.stop();     // a página atrás não rola enquanto o palco está aberto

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // FLIP: o card "cresce" até virar o palco
    const from = openFrom.current.getBoundingClientRect();
    const to = frame.current.getBoundingClientRect();
    gsap.fromTo(frame.current,
      { x: from.left - to.left, y: from.top - to.top, scale: from.width / to.width, borderRadius: 20 },
      // power4.out: arranca rápido e freia longo — o vídeo "pousa" no centro com peso
      { x: 0, y: 0, scale: 1, borderRadius: 22, duration: 0.85, ease: 'power4.out', clearProps: 'transform' });
    gsap.fromTo(d.querySelectorAll('.ps-info > *, .ps-close, .ps-count'),
      { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05, delay: 0.25 });
  }

  function close() {
    const d = dlg.current;
    if (!d.open) return;
    vid().pause();
    const done = () => {
      d.close(); vid().removeAttribute('src'); vid().load(); gsap.set(frame.current, { clearProps: 'all' });
      window.__lenis?.start();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    // power2.in: começa devagar e acelera para sair — sensação de "recolher"
    gsap.to(frame.current, { scale: 0.92, autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
  }

  const toggle = () => { const el = vid(); if (el.paused) el.play(); else el.pause(); };
  const go = (dir) => load((idx + dir + VIDEOS.length) % VIDEOS.length);
  const toggleMute = () => { const el = vid(); el.muted = !el.muted; setMuted(el.muted); };

  useEffect(() => {
    const d = dlg.current, el = vid();
    const onCancel = (e) => { e.preventDefault(); close(); };                // Esc
    const onClick = (e) => { if (e.target === d) close(); };                  // clique fora
    const onTime = () => { if (el.duration && bar.current) bar.current.value = Math.round((el.currentTime / el.duration) * 1000); };
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    d.addEventListener('cancel', onCancel);
    d.addEventListener('click', onClick);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      d.removeEventListener('cancel', onCancel); d.removeEventListener('click', onClick);
      el.removeEventListener('timeupdate', onTime); el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause);
    };
  }, []);

  // terminou um vídeo: segue para o próximo, como uma playlist
  useEffect(() => {
    const el = vid();
    const onEnded = () => { if (idx < VIDEOS.length - 1) load(idx + 1); };
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [idx, muted]);

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if ((e.key === ' ' || e.key === 'k') && !/BUTTON|INPUT/.test(e.target.tagName)) { e.preventDefault(); toggle(); }
  };

  const cur = VIDEOS[idx];

  return (
    <section class="palco" id="palco" ref={root} aria-labelledby="palco-title">
      <div class="palco-copy">
        <span class="palco-kicker" data-palco-in>04 — Realize Human em ação</span>
        <h2 class="palco-title" id="palco-title">
          <span class="ln"><span>A teoria,</span></span>
          <span class="ln"><span>a gente leva</span></span>
          <span class="ln"><span>para o <em>palco</em>.</span></span>
        </h2>
        <p class="palco-lead" data-palco-in>
          Recortes da 6ª Jornada Farmacêutica: comunicação, relações humanas e o que faz as pessoas
          travarem — dito ao vivo, para quem lidera.
        </p>
        <p class="palco-event" data-palco-in><b>6ª Jornada Farmacêutica</b>Realize Human × Grupo SPN</p>
        <a class="palco-cta" data-palco-in href={WA} target="_blank" rel="noopener noreferrer">Leve uma palestra para sua empresa →</a>
        <p class="palco-hint" data-palco-in>
          <span class="hint-mouse">Passe o mouse para ver a prévia · clique para assistir com som</span>
          <span class="hint-touch">Deslize para o lado · toque para assistir com som</span>
        </p>
      </div>

      <ul class="v-grid" aria-label="Vídeos da 6ª Jornada Farmacêutica">
        {VIDEOS.map((item, i) => (
          <li key={item.full}>
            <button class="v-card" type="button" style={{ '--c': item.color }}
              aria-label={`Assistir com som: ${item.title}, ${item.who} (${item.dur})`} onClick={(e) => open(i, e)}>
              <span class="v-media" aria-hidden="true">
                <img src={item.poster} alt="" width="360" height="640" loading="lazy" decoding="async" />
                <video data-src={item.preview} muted playsinline loop preload="none" />
              </span>
              <span class="v-shade" aria-hidden="true" />
              <span class="v-top" aria-hidden="true">
                <span class="v-tag">{item.tag}</span>
                <span class="v-dur">{item.dur}</span>
              </span>
              <span class="v-play" aria-hidden="true">{Icon.play}</span>
              <span class="v-info" aria-hidden="true"><b>{item.title}</b><small>{item.who}</small></span>
              <span class="v-progress" aria-hidden="true"><i /></span>
            </button>
          </li>
        ))}
      </ul>

      <dialog class={`ps${paused ? ' is-paused' : ''}`} ref={dlg} aria-label="Modo palco" data-lenis-prevent onKeyDown={onKey} style={{ '--c': cur.color }}>
        <div class="ps-spot" aria-hidden="true" />
        <span class="ps-count" aria-hidden="true">{String(idx + 1).padStart(2, '0')} / {String(VIDEOS.length).padStart(2, '0')}</span>
        <figure class="ps-frame" ref={frame}>
          <video ref={full} playsinline preload="none" poster={cur.poster} />
          <button class="ps-toggle" type="button" onClick={toggle} aria-label={paused ? 'Reproduzir' : 'Pausar'}>
            <span>{paused ? Icon.play : Icon.pause}</span>
          </button>
        </figure>
        <div class="ps-info">
          <span class="ps-tag">{cur.tag}</span>
          <h3>{cur.title}</h3>
          <p>{cur.who} · 6ª Jornada Farmacêutica</p>
          <input class="ps-bar" ref={bar} type="range" min="0" max="1000" defaultValue="0" aria-label="Posição do vídeo"
            onInput={(e) => { const el = vid(); if (el.duration) el.currentTime = (e.currentTarget.value / 1000) * el.duration; }} />
          <div class="ps-ctrl">
            <button class="ps-btn" type="button" onClick={() => go(-1)} aria-label="Vídeo anterior">{Icon.prev}</button>
            <button class="ps-btn" type="button" onClick={toggle} aria-label={paused ? 'Reproduzir' : 'Pausar'}>{paused ? Icon.play : Icon.pause}</button>
            <button class="ps-btn" type="button" onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Silenciar'}>{muted ? Icon.mute : Icon.sound}</button>
            <button class="ps-btn" type="button" onClick={() => go(1)} aria-label="Próximo vídeo">{Icon.next}</button>
          </div>
        </div>
        <button class="ps-close" type="button" onClick={close} aria-label="Fechar">{Icon.close}</button>
      </dialog>
    </section>
  );
}
