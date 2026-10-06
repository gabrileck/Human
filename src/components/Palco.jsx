import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import '../styles/palco.css';

const WA = 'https://wa.me/5541997135842';
const base = import.meta.env.BASE_URL;
const v = (f) => `${base}videos/${f}`;

// Recortes da 6ª Jornada Farmacêutica (Realize Human × Grupo SPN)
const VIDEOS = [
  {
    tag: 'Bastidores', color: '#ff4f8c', figure: 'metodo-rosa.webp', ribbon: 150, dur: '0:40',
    title: 'Comunicação que transforma relações', who: 'Realize Human × Grupo SPN',
    poster: v('palco-1.webp'), preview: v('palco-1-previa.mp4'), full: v('palco-1.mp4'),
  },
  {
    tag: 'Palestra', color: '#00b8f0', figure: 'metodo-azul.webp', ribbon: 60, dur: '0:36',
    title: 'Por que você trava na hora de falar?', who: 'Gisele Novaes',
    poster: v('palco-2.webp'), preview: v('palco-2-previa.mp4'), full: v('palco-2.mp4'),
  },
  {
    tag: 'Comunicação', color: '#00c97a', figure: 'metodo-verde.webp', ribbon: 200, dur: '0:40',
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
 * Os vídeos viram credenciais de evento penduradas por cordões (como a da 6ª Jornada),
 * com física de pêndulo: balançam com o scroll, com o mouse e podem ser arrastadas.
 * Passar o mouse toca a prévia muda; clicar abre o "modo palco" com som.
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

  /* ================= física + prévias + entrada ================= */
  useEffect(() => {
    const sec = root.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;
    const q = gsap.utils.selector(sec);
    const hangs = q('.cred-hang');
    const light = q('.palco-light')[0];
    const rack = q('.palco-rack')[0];
    const off = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); off.push(() => el.removeEventListener(ev, fn, opt)); };

    // cada credencial é um pêndulo: θ (ângulo) e ω (velocidade angular)
    const items = hangs.map((hang, i) => {
      const swing = hang.querySelector('.cred-swing');
      const card = hang.querySelector('.cred');
      const video = hang.querySelector('video');
      return { hang, swing, card, video, i, theta: 0, omega: 0, len: 400, drag: null, dragged: false, last: '' };
    });
    const measure = () => items.forEach((it) => { it.len = Math.max(200, it.swing.offsetHeight * 0.75); });
    measure();
    on(window, 'resize', measure, { passive: true });

    /* ---------- loop: só roda enquanto algo se mexe e a seção está visível ---------- */
    let visible = false, raf = 0, prev = 0;
    let lx = innerWidth * 0.7, ly = innerHeight * 0.3, tlx = lx, tly = ly;   // holofote
    const G = 2600, DAMP = 1.1, MAX = 6;

    function tick(now) {
      raf = 0;
      const dt = Math.min((now - prev) / 1000, 0.033); prev = now;
      let moving = false;
      for (const it of items) {
        if (it.drag) { moving = true; continue; }
        // pêndulo amortecido: α = -(g/L)·sen θ − c·ω
        const alpha = -(G / it.len) * Math.sin(it.theta) - DAMP * it.omega;
        it.omega = Math.max(-MAX, Math.min(MAX, it.omega + alpha * dt));
        it.theta += it.omega * dt;
        if (Math.abs(it.theta) > 0.0008 || Math.abs(it.omega) > 0.002) moving = true;
      }
      for (const it of items) {
        const t = `rotate(${it.theta.toFixed(4)}rad)`;
        if (t !== it.last) { it.swing.style.transform = t; it.last = t; }
      }
      // holofote persegue o alvo (credencial ativa ou mouse)
      const k = 1 - Math.exp(-dt * 5);
      lx += (tlx - lx) * k; ly += (tly - ly) * k;
      light.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      if (Math.abs(tlx - lx) > 0.5 || Math.abs(tly - ly) > 0.5) moving = true;

      if (moving && visible) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf && visible) { prev = performance.now(); raf = requestAnimationFrame(tick); } };
    const nudge = (it, w) => { if (!reduce) { it.omega += w; kick(); } };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { rootMargin: '100px 0px' });
    io.observe(sec);
    off.push(() => io.disconnect());

    /* ---------- o scroll balança os cordões (a inércia "puxa" as credenciais) ---------- */
    let lastY = scrollY, lastX = 0;
    on(window, 'scroll', () => {
      const dy = scrollY - lastY; lastY = scrollY;
      if (!visible) return;
      items.forEach((it) => nudge(it, -dy * 0.0035 * (0.8 + it.i * 0.18)));
    }, { passive: true });
    on(rack, 'scroll', () => {   // fileira lateral do celular
      const dx = rack.scrollLeft - lastX; lastX = rack.scrollLeft;
      items.forEach((it) => nudge(it, dx * 0.004));
    }, { passive: true });

    /* ---------- holofote segue o mouse ---------- */
    on(sec, 'pointermove', (e) => {
      const r = sec.getBoundingClientRect();
      tlx = e.clientX - r.left; tly = e.clientY - r.top;
      kick();
    }, { passive: true });

    /* ---------- prévia muda: toca ao passar o mouse (desktop) ou ao aparecer (toque) ---------- */
    const play = (it) => {
      if (dlg.current?.open) return;
      const vid = it.video;
      if (!vid.src) vid.src = vid.dataset.src;   // só baixa a prévia quando for usada
      vid.play().then(() => it.card.classList.add('is-playing')).catch(() => {});
    };
    const stop = (it) => { it.video.pause(); it.card.classList.remove('is-playing'); };

    items.forEach((it) => {
      const card = it.card;
      if (fine) {
        on(card, 'pointerenter', () => {
          play(it);
          const r = card.getBoundingClientRect(), s = sec.getBoundingClientRect();
          tlx = r.left + r.width / 2 - s.left; tly = r.top + r.height / 2 - s.top; kick();
        });
        on(card, 'pointerleave', () => stop(it));
        on(card, 'focus', () => play(it));
        on(card, 'blur', () => stop(it));
        // "esbarrar" com o mouse empurra a credencial — de leve, para ela não fugir do cursor
        on(card, 'pointermove', (e) => {
          if (!it.drag) nudge(it, Math.max(-0.08, Math.min(0.08, -e.movementX * 0.0012)));
        }, { passive: true });
      }

      /* arrastar (mouse/caneta): o ângulo segue o ponteiro em volta do topo do cordão */
      on(card, 'pointerdown', (e) => {
        if (e.pointerType === 'touch' || reduce) return;
        const r = it.hang.getBoundingClientRect();
        it.drag = { px: r.left + r.width / 2, py: r.top, x0: e.clientX, t: performance.now() };
        it.dragged = false;
        card.setPointerCapture(e.pointerId);
      });
      on(card, 'pointermove', (e) => {
        const d = it.drag;
        if (!d) return;
        if (Math.abs(e.clientX - d.x0) > 6) it.dragged = true;
        if (!it.dragged) return;
        const theta = Math.max(-1.1, Math.min(1.1, -Math.atan2(e.clientX - d.px, Math.max(40, e.clientY - d.py))));
        const now = performance.now();
        it.omega = (theta - it.theta) / Math.max(0.008, (now - d.t) / 1000);   // velocidade para o "arremesso"
        it.theta = theta; d.t = now;
        it.swing.style.transform = `rotate(${theta.toFixed(4)}rad)`; it.last = '';
        kick();
      });
      const end = () => { if (it.drag) { it.drag = null; kick(); } };
      on(card, 'pointerup', end);
      on(card, 'pointercancel', end);
      // um arraste não conta como clique
      on(card, 'click', (e) => { if (it.dragged) { e.preventDefault(); e.stopImmediatePropagation(); it.dragged = false; } }, true);
    });

    if (!fine) {
      const vio = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const it = items.find((x) => x.card === en.target);
          if (en.intersectionRatio > 0.6) play(it); else stop(it);
        });
      }, { threshold: [0, 0.6] });
      items.forEach((it) => vio.observe(it.card));
      off.push(() => vio.disconnect());
    }

    /* ---------- entrada: credenciais "caem" e ficam balançando ---------- */
    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap.set(hangs, { y: () => -innerHeight * 0.9 });
      gsap.set(q('.palco-title .ln > span'), { yPercent: 110 });
      gsap.set(q('[data-palco-in]'), { autoAlpha: 0, y: 18 });

      const tl = gsap.timeline({ paused: true });
      tl
        // título sobe de trás da máscara: power4.out, seco e firme (mesma assinatura do site)
        .to(q('.palco-title .ln > span'), { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09 })
        .to(q('[data-palco-in]'), { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, '-=0.7')
        // credenciais caem penduradas: elastic.out quica no fim do cordão, como algo leve
        // preso por uma fita. Cada uma, ao "esticar" o cordão, ganha um balanço próprio.
        .to(hangs, {
          y: 0, duration: 1.6, ease: 'elastic.out(1, 0.55)', stagger: 0.14,
          // na tela estreita o balanço é menor, para a credencial não sair da fileira
          onComplete() { items.forEach((it, i) => nudge(it, (i % 2 ? 1 : -1) * (1.2 + Math.random()) * (fine ? 1 : 0.45))); },
        }, '<0.1');

      const sio = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { tl.play(); sio.disconnect(); }
      }, { threshold: 0.3 });
      sio.observe(sec);
      off.push(() => sio.disconnect());
    }, sec);

    return () => { cancelAnimationFrame(raf); off.forEach((fn) => fn()); ctx.revert(); };
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
    root.current.querySelectorAll('.cred video').forEach((x) => x.pause());
    root.current.querySelectorAll('.cred.is-playing').forEach((x) => x.classList.remove('is-playing'));
    openFrom.current = e.currentTarget.querySelector('.cred-screen');
    load(i);                    // play() ainda dentro do clique: o navegador libera o som
    d.showModal();
    window.__lenis?.stop();     // a página atrás não rola enquanto o palco está aberto

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // FLIP: a tela da credencial "cresce" até virar o palco
    const from = openFrom.current.getBoundingClientRect();
    const to = frame.current.getBoundingClientRect();
    gsap.fromTo(frame.current,
      { x: from.left - to.left, y: from.top - to.top, scale: from.width / to.width, borderRadius: 10 },
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
      <div class="palco-light" aria-hidden="true" />

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
          <span class="hint-mouse">Arraste as credenciais · clique para assistir com som</span>
          <span class="hint-touch">Deslize para o lado · toque para assistir com som</span>
        </p>
      </div>

      <div class="palco-rack" role="list" aria-label="Vídeos da 6ª Jornada Farmacêutica">
        {VIDEOS.map((item, i) => (
          <div class="cred-hang" role="listitem" key={item.full} style={{ '--c': item.color, '--ribbon': `${item.ribbon}px` }}>
            <div class="cred-swing">
              <div class="cred-ribbon" aria-hidden="true"><span>Realize Human · Realize Human · Realize Human</span></div>
              <div class="cred-clip" aria-hidden="true" />
              <button class="cred" type="button" aria-label={`Assistir com som: ${item.title} (${item.dur})`} onClick={(e) => open(i, e)}>
                <span class="cred-head" aria-hidden="true">
                  <span>Credencial</span>
                  <img src={`${base}assets/${item.figure}`} alt="" width="26" height="30" loading="lazy" decoding="async" />
                </span>
                <span class="cred-screen">
                  <img src={item.poster} alt="" width="360" height="640" loading="lazy" decoding="async" />
                  <video data-src={item.preview} muted playsinline loop preload="none" aria-hidden="true" />
                  <span class="cred-live" aria-hidden="true">PRÉVIA</span>
                  <span class="cred-play" aria-hidden="true">{Icon.play}</span>
                  <span class="cred-dur" aria-hidden="true">{item.dur}</span>
                </span>
                <span class="cred-body"><b>{item.title}</b><small>{item.who}</small></span>
                <span class="cred-foot">{item.tag}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

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
