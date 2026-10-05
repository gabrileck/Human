import { useEffect, useRef } from 'preact/hooks';
import gsap from 'gsap';
import '../styles/hero.css';

const WA = 'https://wa.me/5541997135842';
// <picture> com AVIF (menor) e WebP de reserva; srcset/sizes gerados no build (index.astro)
function Pic({ img, alt = '', anim, priority = false }) {
  return (
    <picture>
      <source type="image/avif" srcset={img.avif} sizes={img.sizes} />
      <img data-hero-in data-in={anim} src={img.src} srcset={img.webp} sizes={img.sizes} alt={alt}
        width="1254" height="1254" decoding="async" fetchpriority={priority ? 'high' : undefined} />
    </picture>
  );
}

/**
 * Primeira dobra. Hidratada com `client:load`: o parallax e a entrada precisam
 * estar ativos assim que a página abre.
 */
export default function Hero({ images }) {
  const root = useRef(null);

  /* ---------------- Entrada: timeline GSAP encadeada ---------------- */
  useEffect(() => {
    document.documentElement.classList.add('hero-ready');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // gsap.context limita os seletores a este componente e desfaz tudo no cleanup
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const show = { autoAlpha: 1 };   // autoAlpha = opacity + visibility (o CSS começa com os dois escondidos)

      if (reduce) { gsap.set(q('[data-hero-in]'), show); gsap.set(q('h1 .line > span'), { y: 0, yPercent: 0 }); return; }

      const tl = gsap.timeline({
        // padrão da timeline: power3.out — sai rápido e desacelera de forma longa.
        // A desaceleração longa é o que dá sensação de massa: o elemento "chega e assenta".
        defaults: { ease: 'power3.out', duration: 1 },
        paused: true,   // só começa quando a tela de carregamento libera (ver abaixo)
      });

      tl
        // 1 · Parede. power2.out (curva mais suave que a padrão) + leve zoom-out:
        //     movimento lento e sem pressa = cenário pesado, que não "pula".
        .fromTo(q('[data-in="wall"]'), { autoAlpha: 0, scale: 1.08 }, { ...show, scale: 1, duration: 1.6, ease: 'power2.out' })

        // 2 · Estante. Começa 0.15 s depois do INÍCIO da parede ("<0.15"):
        //     as camadas de fundo andam quase juntas, como um bloco só.
        .fromTo(q('[data-in="shelf"]'), { autoAlpha: 0, y: 40 }, { ...show, y: 0, duration: 1.3 }, '<0.15')

        // 3 · Pessoas. expo.out: a curva mais "freada" do GSAP — percorre ~90% do caminho
        //     no primeiro terço e passa o resto do tempo assentando. Lê-se como algo pesado
        //     que pousa no chão. "-=0.9": entra quando a estante ainda está chegando (overlap).
        .fromTo(q('[data-in="man"]'), { autoAlpha: 0, y: 90 }, { ...show, y: 0, duration: 1.5, ease: 'expo.out' }, '-=0.9')
        //     A mulher vem 0.12 s depois do homem ("<0.12"): o pequeno atraso cria profundidade.
        .fromTo(q('[data-in="woman"]'), { autoAlpha: 0, y: 110 }, { ...show, y: 0, duration: 1.5, ease: 'expo.out' }, '<0.12')

        // 4 · Palavra gigante. sine.out: aceleração quase linear e final macio —
        //     sem "freada", parece leve, flutuando atrás das pessoas.
        .fromTo(q('[data-in="word"]'), { autoAlpha: 0, y: -24 }, { ...show, y: 0, duration: 1.4, ease: 'sine.out' }, '-=1.2')

        // 5 · Texto. Começa bem antes das imagens terminarem ("-=1.1") para não haver tempo morto.
        .fromTo(q('[data-in="nav"]'), { autoAlpha: 0, y: -12 }, { ...show, y: 0, duration: 0.8 }, '-=1.1')
        .fromTo(q('[data-in="eyebrow"]'), { autoAlpha: 0, x: -16 }, { ...show, x: 0, duration: 0.8 }, '-=0.6')
        //     Linhas do título: power4.out é mais "seca" que a power3 — sobe rápido e para firme,
        //     dando peso tipográfico. stagger 0.08 encadeia as 4 linhas em cascata.
        //     (y: 0 zera o translateY(110%) do CSS inicial, que o GSAP leria como pixels)
        .fromTo(q('h1 .line > span'), { y: 0, yPercent: 110 }, { y: 0, yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.08 }, '-=0.5')
        //     Parágrafo, botões e números: entram enquanto a última linha ainda assenta ("-=0.7").
        .fromTo(q('[data-in="lead"], [data-in="ctas"], [data-in="proof"]'),
          { autoAlpha: 0, y: 16 }, { ...show, y: 0, duration: 0.8, stagger: 0.1 }, '-=0.7')

        // 6 · Selo. back.out(1.7): passa um pouco do ponto e volta (overshoot).
        //     O "quique" comunica um objeto leve, de interface — contraste com o peso das fotos.
        .fromTo(q('[data-in="badge"]'), { autoAlpha: 0, y: 24, scale: 0.85 }, { ...show, y: 0, scale: 1, duration: 0.9, ease: 'back.out(1.7)' }, '-=0.4');

      // A tela de carregamento avisa quando a cortina começa a subir (classe `site-go` para
      // quem hidratar depois do aviso, evento `site:go` para quem já está esperando).
      if (document.documentElement.classList.contains('site-go')) tl.play();
      else addEventListener('site:go', () => tl.play(), { once: true });
    }, root);

    return () => ctx.revert();
  }, []);

  /* ---------------- Parallax: mouse/inclinação + scroll ---------------- */
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hero = root.current;
    const items = [...hero.querySelectorAll('.layer')].map((el) => ({ el, d: +el.dataset.depth || 0, s: +el.dataset.speed || 0, v: '' }));
    const fades = [...hero.querySelectorAll('[data-fade]')];
    let tx = 0, ty = 0, mx = 0, my = 0, W = innerWidth, H = innerHeight;
    let raf = 0, prev = 0, lastSy = -1, fadeP = -1;

    function tick(now) {
      raf = 0;
      const k = 1 - Math.exp(-Math.min((now - prev) / 1000, 0.05) * 4.5);   // igual em 60 Hz ou 144 Hz
      prev = now;
      mx += (tx - mx) * k;
      my += (ty - my) * k;
      const sy = Math.min(scrollY, H * 1.2);
      const moving = Math.abs(tx - mx) > 0.0005 || Math.abs(ty - my) > 0.0005;
      if (!moving && sy === lastSy) return;            // nada mudou: o loop dorme
      lastSy = sy;
      for (const it of items) {
        const v = `translate3d(${(-mx * W * it.d).toFixed(1)}px, ${(-my * H * it.d + sy * it.s).toFixed(1)}px, 0)`;
        if (v !== it.v) { it.el.style.transform = v; it.v = v; }
      }
      const p = Math.min(sy / (H * 0.6), 1);
      if (p !== fadeP) {
        for (const el of fades) {
          el.style.opacity = p ? 1 - p : '';
          el.style.translate = p ? `0 ${(-sy * 0.25).toFixed(1)}px` : '';
        }
        fadeP = p;
      }
      if (moving) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(tick); } };
    const onResize = () => { W = innerWidth; H = innerHeight; lastSy = -1; kick(); };
    const onMove = (e) => { tx = e.clientX / W - 0.5; ty = e.clientY / H - 0.5; kick(); };
    const onLeave = () => { tx = ty = 0; kick(); };
    const onTilt = (e) => {
      if (e.gamma == null) return;
      tx = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
      ty = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60));
      kick();
    };
    const fine = matchMedia('(pointer: fine)').matches;

    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', onResize, { passive: true });
    if (fine) { hero.addEventListener('pointermove', onMove, { passive: true }); hero.addEventListener('pointerleave', onLeave); }
    else addEventListener('deviceorientation', onTilt);   // celular: inclina o aparelho
    kick();

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', kick);
      removeEventListener('resize', onResize);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  return (
    <section class="hero" id="hero" ref={root}>
      {/* camadas de parallax: data-depth = mouse, data-speed = scroll */}
      <div class="layer l-wall" data-depth="0.012" data-speed="0.35">
        <Pic img={images.wall} anim="wall" priority />
      </div>

      <div class="stage" aria-hidden="true">
        <div class="layer l-shelf" data-depth="0.022" data-speed="0.22">
          <Pic img={images.shelf} anim="shelf" />
        </div>
        <div class="layer l-word" data-depth="0.035" data-speed="0.12">
          <span data-hero-in data-in="word">Realize</span>
        </div>
        <div class="layer l-man" data-depth="0.05" data-speed="0.05">
          <Pic img={images.man} anim="man" />
        </div>
        <div class="layer l-woman" data-depth="0.075" data-speed="0">
          <Pic img={images.woman} anim="woman" priority />
        </div>
      </div>

      <nav class="nav" data-hero-in data-in="nav">
        <a class="logo" href="#hero">Realize Human<i>.</i></a>
        <ul>
          <li><a class="link" href="#dobra3d">Sobre</a></li>
          <li><a class="link" href="#metodo">Método</a></li>
          <li><a class="link" href="https://realizehuman.com.br/blog">Conteúdos</a></li>
          <li><a class="link" href="https://vagas.realizehuman.com.br">Portal de vagas</a></li>
        </ul>
        <a class="pill" href={WA} target="_blank" rel="noopener noreferrer">Fale conosco</a>
      </nav>

      <div class="content" data-fade>
        <span class="eyebrow" data-hero-in data-in="eyebrow">Consultoria de RH estratégico</span>
        <h1>
          <span class="line"><span>Não falta estratégia.</span></span>
          <span class="line"><span>Falta a <em>pessoa certa</em>,</span></span>
          <span class="line"><span>no lugar certo, tomando</span></span>
          <span class="line"><span>a <em>decisão certa</em>.</span></span>
        </h1>
        <p class="lead" data-hero-in data-in="lead">
          A Realize Human estrutura liderança, cultura e contratação. Com método, não com achismo.
        </p>
        <div class="ctas" data-hero-in data-in="ctas">
          <a class="btn btn-primary" href={WA} target="_blank" rel="noopener noreferrer">
            Quero o diagnóstico gratuito
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </a>
          <a class="btn btn-ghost" href="#metodo">Conhecer o método</a>
        </div>
        <div class="proof" data-hero-in data-in="proof">
          <div><b>15+</b><span>anos de experiência</span></div>
          <div><b>500+</b><span>líderes impactados</span></div>
        </div>
      </div>

      <div class="badge-pos" data-fade>
        <div class="badge" data-hero-in data-in="badge">
          <div class="dot">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z" /></svg>
          </div>
          <div>
            <strong>Mentoria estratégica</strong>
            <small>Inicie sua transformação hoje</small>
          </div>
        </div>
      </div>
    </section>
  );
}
