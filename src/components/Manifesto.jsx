import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import '../styles/manifesto.css';

const WA = 'https://wa.me/5541997135842';
const base = import.meta.env.BASE_URL;

// As palavras-chave do vídeo, na ordem em que aparecem
const WORDS = ['Comunicação', 'Impacto', 'Conexão', 'Pensar', 'Olhar', 'Analisar', 'Refletir', 'Perceber', 'Consciente',
  'Poderosa', 'Únicos', 'Mundo mental', 'Human', 'Pessoas', 'Relações', 'Consciência', 'Resultado'];
// [segundo em que a palavra surge no vídeo, índice em WORDS] — medidos quadro a quadro.
// Palavras que voltam (comunicação, conexão) reacendem a mesma; -1 = fim (o logo se monta).
const CUES = [
  [4.0, 0], [4.5, 1], [7.3, 2], [9.25, 3], [10.25, 4], [10.75, 5], [11.25, 6], [12.25, 7],
  [16.75, 0], [18.0, 8], [20.9, 9], [22.25, 10], [27.75, 11], [31.0, 12], [32.0, 13], [33.0, 14],
  [34.0, 15], [35.0, 2], [39.25, 16], [40.6, -1],
];
const firstAt = WORDS.map((_, i) => CUES.find((c) => c[1] === i)[0]);

const Icon = {
  sound: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>,
  mute: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m22 9-6 6M16 9l6 6" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>,
};

/**
 * 5ª dobra — "Manifesto".
 * O vídeo vertical em destaque e, ao lado, um texto feito das palavras-chave do vídeo: cada uma
 * acende com as cores do logo no instante em que aparece na tela (as já ditas ficam brancas, as
 * que vêm ficam só no contorno). Clicar numa palavra leva o vídeo até ela.
 * O vídeo toca mudo e em loop enquanto está na tela; o botão de som recomeça do início com áudio.
 */
export default function Manifesto() {
  const root = useRef(null);
  const video = useRef(null);
  const bar = useRef(null);
  const words = useRef([]);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const sec = root.current;
    const vid = video.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, lastCue = -2, lastPast = -1, wantPlay = false;

    // estado das palavras: só mexe no DOM quando muda
    const paint = (t) => {
      let cue = -2;
      for (let k = 0; k < CUES.length && CUES[k][0] <= t + 0.05; k++) cue = k;
      const active = cue >= 0 ? CUES[cue][1] : -2;
      const ended = active === -1;
      let past = -1;
      firstAt.forEach((ft, i) => { if (ft <= t + 0.05) past = Math.max(past, i); });
      if (cue === lastCue && past === lastPast) return;
      lastCue = cue; lastPast = past;
      words.current.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle('is-on', i === active);
        el.classList.toggle('is-past', ended || (firstAt[i] <= t + 0.05 && i !== active));
      });
      sec.classList.toggle('is-end', ended);
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = vid.currentTime;
      if (vid.duration) bar.current.style.transform = `scaleX(${(t / vid.duration).toFixed(4)})`;
      paint(t);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    const onPlay = () => { setPaused(false); start(); };
    const onPause = () => { setPaused(true); stop(); paint(vid.currentTime); };
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('seeked', () => paint(vid.currentTime));

    // toca (mudo) só enquanto o vídeo está na tela; o arquivo só é baixado aqui
    const io = new IntersectionObserver(([e]) => {
      wantPlay = e.isIntersecting;
      if (wantPlay) {
        if (!vid.src) { vid.src = vid.dataset.src; vid.currentTime = 0.8; }   // pula a abertura preta
        if (!reduce || !vid.muted) vid.play().catch(() => {});
      } else if (!vid.paused) vid.pause();
    }, { threshold: 0.45 });
    io.observe(vid);

    /* ---------- entrada: título sobe, palavras surgem em cascata, vídeo assenta ---------- */
    const q = gsap.utils.selector(sec);
    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap.set(q('.mf-title .ln > span'), { yPercent: 110 });
      gsap.set(q('[data-mf-in]'), { autoAlpha: 0, y: 18 });
      gsap.set(q('.mf-word'), { autoAlpha: 0, y: 24 });
      gsap.set(q('.mf-frame'), { autoAlpha: 0, y: 60, scale: 0.96 });
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl
        // mesma assinatura das outras dobras: o título sobe rápido e para firme
        .to(q('.mf-title .ln > span'), { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09 })
        // o vídeo assenta devagar (expo.out: chega rápido, passa o resto do tempo pousando)
        .to(q('.mf-frame'), { autoAlpha: 1, y: 0, scale: 1, duration: 1.4, ease: 'expo.out' }, '<0.1')
        // as palavras aparecem como quem lê o manifesto: cascata curta, sem quique
        .to(q('.mf-word'), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.035 }, '<0.2')
        .to(q('[data-mf-in]'), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 }, '-=0.5');
      const io2 = new IntersectionObserver(([e]) => { if (e.isIntersecting) { tl.play(); io2.disconnect(); } }, { threshold: 0.2 });
      io2.observe(sec);
    }, sec);

    return () => { stop(); io.disconnect(); ctx.revert(); vid.removeEventListener('play', onPlay); vid.removeEventListener('pause', onPause); };
  }, []);

  const vid = () => video.current;
  const ensureSrc = () => { const v = vid(); if (!v.src) v.src = v.dataset.src; return v; };

  // som: na primeira vez recomeça do início, para ouvir a mensagem inteira
  const toggleSound = () => {
    const v = ensureSrc();
    if (v.muted) { v.muted = false; v.currentTime = 0; v.play().catch(() => {}); }
    else v.muted = true;
    setMuted(v.muted);
  };
  const togglePlay = () => { const v = ensureSrc(); if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const seekTo = (i) => {
    const v = ensureSrc();
    const go = () => { v.currentTime = Math.max(0, firstAt[i] - 0.15); v.play().catch(() => {}); };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  };

  return (
    <section class="mf" id="manifesto" ref={root} aria-labelledby="mf-title">
      <div class="mf-glow" aria-hidden="true" />

      <div class="mf-head">
        <span class="mf-kicker" data-mf-in>05 — Manifesto</span>
        <h2 class="mf-title" id="mf-title">
          <span class="ln"><span>Comunicação consciente,</span></span>
          <span class="ln"><span><em>relações humanas</em>.</span></span>
        </h2>
      </div>

      <figure class="mf-media">
        <div class="mf-frame">
          <video ref={video} data-src={`${base}videos/manifesto.mp4`} poster={`${base}videos/manifesto.webp`}
            muted loop playsInline preload="none" width="720" height="1280"
            aria-label="Vídeo manifesto da Realize Human na 6ª Jornada Farmacêutica" onClick={togglePlay} />
          {paused && <button type="button" class="mf-play" onClick={togglePlay} aria-label="Tocar o vídeo">{Icon.play}</button>}
          <button type="button" class={`mf-sound${muted ? '' : ' is-on'}`} onClick={toggleSound} aria-pressed={!muted}>
            {muted ? Icon.mute : Icon.sound}<span>{muted ? 'Ouvir com som' : 'Som ligado'}</span>
          </button>
          <div class="mf-bar" aria-hidden="true"><i ref={bar} /></div>
        </div>
        <figcaption class="mf-tag">6ª Jornada Farmacêutica · Grupo SPN</figcaption>
      </figure>

      <div class="mf-body">
        <p class="mf-words">
          {WORDS.map((w, i) => (
            <button type="button" class="mf-word" key={w} ref={(el) => { words.current[i] = el; }}
              onClick={() => seekTo(i)} aria-label={`Ir para “${w}” no vídeo`}>{w}</button>
          ))}
        </p>
        <p class="mf-hint" data-mf-in>As palavras acendem junto com o vídeo · toque numa para ir até ela</p>
        <div class="mf-actions" data-mf-in>
          <a class="mf-cta" href={WA} target="_blank" rel="noopener noreferrer">Agende uma conversa <span aria-hidden="true">→</span></a>
          <a class="mf-top" href="#hero">Voltar ao topo ↑</a>
        </div>
      </div>

    </section>
  );
}
