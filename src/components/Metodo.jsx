import { useEffect, useRef } from 'preact/hooks';
import gsap from 'gsap';
import '../styles/metodo.css';

const asset = (f) => `${import.meta.env.BASE_URL}assets/${f}`;

const ICONS = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  brain: <>
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /><path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
    <path d="M19.938 10.5a4 4 0 0 1 .585.396" /><path d="M6 18a4 4 0 0 1-1.967-.516" />
    <path d="M19.967 17.484A4 4 0 0 1 18 18" />
  </>,
  trend: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
};

const CARDS = [
  { img: 'metodo-rosa.webp', color: '#93278f', icon: 'search', title: ['Realize Hunter™'] },
  { img: 'metodo-azul.webp', color: '#00d1ff', icon: 'brain', title: ['Assessment'] },
  { img: 'metodo-verde.webp', color: '#00ff94', icon: 'trend', title: ['PDL –', 'Liderança'] },
  { img: 'metodo-laranja.webp', color: '#ffd700', icon: 'users', title: ['BPO estratégico', 'de RH'] },
];

/**
 * Terceira dobra. Hidratada com `client:visible` (com folga de 1 tela via rootMargin),
 * para a cortina já estar ativa antes da seção aparecer.
 */
export default function Metodo() {
  const root = useRef(null);

  useEffect(() => {
    const sec = root.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const q = gsap.utils.selector(sec);
    let revealed = false, raf = 0, lastB = -1;
    const cap = sec.querySelector('.metodo-cap'), bg = sec.querySelector('.metodo-bg');
    const cleanups = [];

    const ctx = gsap.context(() => {
      /* ---------- Entrada (roda uma vez, quando a cortina cobre a tela) ---------- */
      const enterCard = { autoAlpha: 1, y: 0, scale: 1 };
      const afterCards = (cards = q('.m-card')) => {
        // devolve o transform ao CSS para o hover voltar a funcionar
        cards.forEach((c) => {
          gsap.set([c, c.querySelector('.m-figure')], { clearProps: 'transform' });
          c.classList.add('entered');
        });
      };

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl
        // Kicker sobe de trás da máscara. power4.out: arrancada forte, parada firme —
        // texto pequeno precisa parecer "preciso", não flutuante.
        .fromTo(q('.mask > *')[0], { y: 0, yPercent: 110 }, { y: 0, yPercent: 0, duration: 0.9, ease: 'power4.out' })
        // Título começa 0.1 s depois do kicker ("<0.1"): as duas linhas sobem quase juntas.
        .fromTo(q('.mask > *')[1], { y: 0, yPercent: 110 }, { y: 0, yPercent: 0, duration: 1.1, ease: 'power4.out' }, '<0.1')
        // Preenchimento letra a letra. power1.inOut: quase linear, ritmo constante como tinta
        // escorrendo — sem "freada", então não chama atenção para o fim de cada letra.
        // "-=0.4": começa enquanto o título ainda está terminando de subir.
        .fromTo(q('h2 .ch'), { '--f': 0 }, { '--f': 1, duration: 0.5, ease: 'power1.inOut', stagger: 0.08 }, '-=0.4')
        // Linha ciano. expo.inOut: lenta nas pontas e rápida no meio — "estica" como um traço
        // desenhado à mão. "<" = começa junto com o preenchimento.
        .fromTo(q('.metodo-rule'), { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'expo.inOut' }, '<');

      const mm = gsap.matchMedia();
      cleanups.push(() => mm.revert());

      // Desktop: os 4 cartões estão na tela juntos, então entram NA timeline.
      mm.add('(min-width: 1025px)', () => {
        tl
          // power3.out + leve scale: chega e assenta, peso médio (é um bloco, não uma foto).
          // "-=0.3": os cartões começam antes da linha terminar — overlap entre grupos.
          .fromTo(q('.m-card'), { autoAlpha: 0, y: 40, scale: 0.94 }, { ...enterCard, duration: 1, stagger: 0.12 }, '-=0.3')
          // Bonequinhos: back.out(2) passa do tamanho e volta — o "pop" deixa os ícones 3D
          // leves e simpáticos. "<0.25": cada um aparece logo depois do seu cartão começar.
          .fromTo(q('.m-figure'), { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(2)', stagger: 0.12 }, '<0.25')
          .add(() => afterCards());
      });

      // Tablet/celular: os cartões ficam empilhados; cada um entra quando aparece.
      mm.add('(max-width: 1024px)', () => {
        const io = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting || !revealed) continue;
            io.unobserve(e.target);
            gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => afterCards([e.target]) })
              .fromTo(e.target, { autoAlpha: 0, y: 40, scale: 0.94 }, { ...enterCard, duration: 0.9 })
              .fromTo(e.target.querySelector('.m-figure'), { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(2)' }, '-=0.6');
          }
        }, { rootMargin: '0px 0px -12% 0px' });
        const watch = () => q('.m-card').forEach((c) => io.observe(c));
        // só começa a observar depois que a cortina cobriu a tela
        tl.eventCallback('onStart', watch);
        return () => io.disconnect();
      });

      if (reduce) { tl.progress(1); afterCards(); revealed = true; }

      /* ---------- Cortina: borda de cima em curva, guiada pelo scroll ---------- */
      function curtain() {
        raf = 0;
        const r = sec.getBoundingClientRect(), H = innerHeight;
        const prog = Math.min(1, Math.max(0, 1 - r.top / H));       // 0 = ainda embaixo · 1 = cobriu a tela
        if (prog > 0.82 && !revealed) { revealed = true; tl.play(); }
        // altura da curva (0 a 1): cheia com a seção embaixo, achata até zero ao cobrir a tela
        const b = reduce ? 0 : Math.round((1 - prog) * (1 - prog) * 1000) / 1000;
        if (b !== lastB) {
          cap.style.transform = `scaleY(${b})`;
          bg.style.transform = `translate3d(0, ${(b * 0.42 * H).toFixed(1)}px, 0)`;
          lastB = b;
        }
      }
      const kick = () => { if (!raf) raf = requestAnimationFrame(curtain); };
      addEventListener('scroll', kick, { passive: true });
      addEventListener('resize', kick, { passive: true });
      cleanups.push(() => { removeEventListener('scroll', kick); removeEventListener('resize', kick); cancelAnimationFrame(raf); });
      curtain();
    }, sec);

    return () => { cleanups.forEach((fn) => fn()); ctx.revert(); };
  }, []);

  return (
    <section class="metodo" id="metodo" ref={root}>
      {/* cortina: cúpula (parábola, igual à borda antiga) + fundo */}
      <div class="metodo-cap" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 100 Q50 -100 100 100 Z" fill="#001a33" /></svg>
      </div>
      <div class="metodo-bg" aria-hidden="true" />
      <div class="mask"><span class="metodo-kicker">Metodologia estratégica</span></div>
      <div class="mask">
        <h2 aria-label="Método">
          {[...'Método'].map((c, i) => <span class="ch" aria-hidden="true" key={i}>{c}</span>)}
        </h2>
      </div>
      <div class="metodo-rule" />
      <div class="metodo-grid">
        {CARDS.map((card) => (
          <article class="m-card" key={card.img}>
            <div class="m-figure">
              <img src={asset(card.img)} alt="" width="210" height="240" loading="lazy" decoding="async" />
            </div>
            <div class="m-icon" style={{ '--c': card.color }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                {ICONS[card.icon]}
              </svg>
            </div>
            <h3>{card.title.map((t, i) => <span key={t}>{i > 0 && <br />}{t}</span>)}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
