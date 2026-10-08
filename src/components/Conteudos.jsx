import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import '../styles/conteudos.css';

const WA = 'https://wa.me/5541997135842';
const BLOG = 'https://realizehuman.com.br/blog';
const base = import.meta.env.BASE_URL;

/* ---------- conteúdo real (realizehuman.com.br/blog) ---------- */
const art = (id, cat, date, title, ex) => ({
  id: `a${id}`, cat, date, title, ex, cover: `${base}conteudos/artigo-${id}.webp`, href: `${BLOG}/${id}`, ext: true, cta: 'Ler artigo',
});
const ARTIGOS = [
  art(18, 'Liderança', '2026-09-07', 'Sua empresa funciona sem você?',
    'Quando decisões, problemas e resultados dependem demais do dono, o crescimento encontra um limite. Entenda como liderança, autonomia e gestão estratégica de pessoas ajudam a construir uma empresa preparada para crescer.'),
  art(16, 'Recrutamento', '2026-08-15', 'Flexibilidade não é benefício. É estratégia de retenção.',
    'Empresas que reduzem a flexibilidade podem aumentar o turnover e perder talentos.'),
  art(14, 'BPO', '2026-06-14', 'BPO Estratégico de RH: a solução completa para sua empresa',
    'Para o momento em que pessoas deixam de ser algo que o fundador resolve sozinho.'),
  art(13, 'Liderança', '2026-06-14', 'Desenvolvimento de Líderes: quem está no cargo certo?',
    'A pergunta que a maioria dos empresários evita — e que, respondida com honestidade, muda tudo.'),
  art(12, 'Recrutamento', '2026-06-14', 'Recrutamento Sem Erros: processo seletivo com critério',
    'O processo seletivo é a decisão mais impactante que uma empresa toma sobre pessoas.'),
  art(11, 'Gestão', '2026-06-14', 'Mapeamento Comportamental: avalie o perfil real da sua equipe',
    'Clareza sobre quem realmente está nos cargos: como pensa, decide e performa sob pressão.'),
  art(10, 'BPO', '2026-06-09', 'Quando sua empresa está pronta para o BPO Estratégico de RH, e quando ainda não está',
    'Uma leitura honesta do momento da empresa. Sem promessa vazia e sem venda forçada.'),
  art(8, 'Recrutamento', '2026-06-09', 'Por que sua empresa não consegue contratar bons profissionais — e a culpa não é do mercado',
    'Bons profissionais existem. O que está impedindo não é o mercado. É o processo.'),
  art(7, 'Liderança', '2026-06-08', 'O custo real de um líder despreparado',
    'O melhor executor promovido a líder sem que ninguém perguntasse se ele tinha perfil para liderar.'),
  art(6, 'Cultura', '2026-06-08', 'Cultura não se declara. Se decide.',
    'Cultura não é o que está escrito na parede. É o comportamento que se repete quando o líder não está na sala.'),
];

// cada método aponta para o artigo do blog que o aprofunda
const metodo = (id, title, ex, artigo) => ({
  id, cat: 'Método', title, ex, cover: `${base}conteudos/artigo-${artigo}.webp`, href: `${BLOG}/${artigo}`, ext: true, cta: 'Entender o método',
});
const METODOS = [
  metodo('m-hunter', 'Realize Hunter™', 'Vai além do currículo e da entrevista: mapeamos o perfil comportamental que sua empresa precisa antes de buscar qualquer candidato. Contratação com critério, não com feeling.', 12),
  metodo('m-assessment', 'Assessment', 'Revela o que o cargo não mostra: como a pessoa decide, lidera e performa sob pressão. Antes de contratar, antes de promover.', 11),
  metodo('m-pdl', 'Mentoria PDL — Desenvolvimento de Líderes', 'Para quem já lidera, mas ainda opera como executor: postura, decisão e presença para parar de fazer e começar a dirigir.', 13),
  metodo('m-bpo', 'BPO Estratégico de RH', 'A inteligência de gestão de pessoas dentro da sua empresa, sem montar um departamento do zero. Você foca no negócio.', 14),
];

const recorte = (id, title, who, poster) => ({
  id, cat: 'Evento', who, title, cover: `${base}videos/${poster}`, href: '#palco', cta: 'Assistir',
});
const EVENTOS = [
  { id: 'jornada', cat: 'Evento', title: '6ª Jornada Farmacêutica — Realize Human × Grupo SPN',
    ex: 'Comunicação, relações humanas e o que faz as pessoas travarem — dito ao vivo, para quem lidera.',
    cover: `${base}videos/palco-1.webp`, href: '#palco', cta: 'Assistir aos recortes' },
  recorte('e-1', 'Comunicação que transforma relações', 'Realize Human × Grupo SPN', 'palco-1.webp'),
  recorte('e-2', 'Por que você trava na hora de falar?', 'Gisele Novaes', 'palco-2.webp'),
  recorte('e-3', 'Você só fala — ou se comunica?', 'Gisele Novaes', 'palco-comunicacao.webp'),
];

// categorias ainda sem publicações no blog: estado "em preparação" com aviso pelo WhatsApp
const TABS = [
  { key: 'Artigos', items: ARTIGOS, more: 'Mais artigos' },
  { key: 'Testes', soon: 'testes e diagnósticos' },
  { key: 'Ebooks', soon: 'ebooks' },
  { key: 'Métodos', items: METODOS, more: 'Outros métodos' },
  { key: 'Hub de Liderança', soon: 'materiais do Hub de Liderança' },
  { key: 'Eventos', items: EVENTOS, more: 'Recortes do palco' },
];
const COVERS = TABS.flatMap((t) => t.items || []).filter((it) => it.cover);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmt = (iso) => (iso ? `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '');
const linkProps = (it) => (it.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {});
const notify = (what) => `${WA}?text=${encodeURIComponent(`Olá! Quero ser avisado(a) quando a Realize Human publicar novos ${what}.`)}`;
const LIST = 5;   // itens no índice antes do "mostrar mais"

/**
 * 6ª dobra — Central de conteúdos.
 * Editorial: o conteúdo mais recente em destaque e um índice numerado ao lado. No desktop, passar
 * o mouse num item do índice mostra a capa dele flutuando junto ao cursor (só transform).
 * Abas no mesmo desenho do blog; categorias ainda vazias mostram um estado "em preparação".
 */
export default function Conteudos() {
  const root = useRef(null);
  const panel = useRef(null);
  const peek = useRef(null);
  const [tab, setTab] = useState(0);
  const [more, setMore] = useState(false);
  const [hover, setHover] = useState(null);
  const first = useRef(true);

  const T = TABS[tab];
  const items = T.items || [];
  const [lead, ...rest] = items;
  const list = more ? rest : rest.slice(0, LIST);

  /* ---------- entrada ---------- */
  useEffect(() => {
    const sec = root.current;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = gsap.utils.selector(sec);
    let io;
    const ctx = gsap.context(() => {
      gsap.set(q('.ct-title .ln > span'), { yPercent: 110 });
      gsap.set(q('[data-ct-in]'), { autoAlpha: 0, y: 24 });
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
        // mesma assinatura das outras dobras: o título sobe rápido e para firme
        .to(q('.ct-title .ln > span'), { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09 })
        .to(q('[data-ct-in]'), { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, '-=0.75');
      io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { tl.play(); io.disconnect(); } }, { threshold: 0.15 });
      io.observe(sec);
    }, sec);
    return () => { io?.disconnect(); ctx.revert(); };
  }, []);

  /* ---------- troca de aba: o conteúdo novo entra com um fade curto ---------- */
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(panel.current.children, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06, overwrite: true });
  }, [tab]);

  /* ---------- capa flutuante do índice (desktop) ---------- */
  useEffect(() => {
    const el = peek.current;
    if (!el || !matchMedia('(pointer: fine)').matches) return;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const onMove = (e) => { xTo(e.clientX + 28); yTo(e.clientY - 100); };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, []);

  const pick = (i) => { if (i === tab) return; setTab(i); setMore(false); setHover(null); };

  return (
    <section class="ct" id="conteudos" ref={root} aria-labelledby="ct-title">
      <div class="ct-sheet">
        <header class="ct-head">
          <div>
            <span class="ct-kicker" data-ct-in>06 — Conteúdos estratégicos</span>
            <h2 class="ct-title" id="ct-title">
              <span class="ln"><span>Ideias para quem</span></span>
              <span class="ln"><span><em>decide</em> sobre pessoas.</span></span>
            </h2>
          </div>
          <div class="ct-intro" data-ct-in>
            <p>Artigos, testes, ebooks, métodos e materiais para evoluir liderança, cultura e gestão de pessoas.</p>
            <a class="ct-all" href={BLOG} target="_blank" rel="noopener noreferrer">Ver todos no blog <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <nav class="ct-tabs" aria-label="Categorias de conteúdo" data-ct-in>
          {TABS.map((t, i) => (
            <button type="button" key={t.key} class={`ct-tab${i === tab ? ' is-on' : ''}`} aria-pressed={i === tab} onClick={() => pick(i)}>
              {t.key}{t.items?.length > 1 && <sup>{t.items.length}</sup>}
            </button>
          ))}
        </nav>

        <div class={`ct-panel${T.soon ? ' is-soon' : ''}`} ref={panel} data-ct-in aria-live="polite">
          {T.soon ? (
            <div class="ct-empty">
              <span class="ct-empty-mark" aria-hidden="true">{T.key}</span>
              <div class="ct-empty-copy">
                <span class="ct-cat">Em preparação</span>
                <h3>Novos {T.soon} em breve.</h3>
                <p>Estamos preparando os próximos materiais desta categoria. Quer receber um aviso assim que forem publicados?</p>
                <div class="ct-actions">
                  <a class="ct-btn" href={notify(T.soon)} target="_blank" rel="noopener noreferrer">Quero ser avisado <span aria-hidden="true">→</span></a>
                  <button type="button" class="ct-link" onClick={() => pick(0)}>Enquanto isso, ler os artigos</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <a class="ct-lead" href={lead.href} {...linkProps(lead)}>
                <span class="ct-cover">
                  {lead.cover
                    ? <img src={lead.cover} alt="" width="720" height="450" loading="lazy" decoding="async" />
                    : <span class="ct-cover-art" aria-hidden="true">{lead.art}</span>}
                </span>
                <span class="ct-meta"><span class="ct-cat">{lead.cat}</span>{lead.date && <time datetime={lead.date}>{fmt(lead.date)}</time>}</span>
                <h3>{lead.title}</h3>
                <p>{lead.ex}</p>
                <span class="ct-more">{lead.cta} <span aria-hidden="true">{lead.ext ? '→' : '↑'}</span></span>
              </a>

              {rest.length > 0 ? (
                <div class="ct-index">
                  <span class="ct-index-label">{T.more}</span>
                  <ol onPointerLeave={() => setHover(null)}>
                    {list.map((it, i) => (
                      <li key={it.id}>
                        <a href={it.href} {...linkProps(it)} onPointerEnter={() => setHover(it)}>
                          <span class="ct-n">{String(i + 2).padStart(2, '0')}</span>
                          <span class="ct-it">
                            <span class="ct-meta"><span class="ct-cat">{it.cat}</span>{it.date ? <time datetime={it.date}>{fmt(it.date)}</time> : it.who && <span>{it.who}</span>}</span>
                            <span class="ct-t">{it.title}</span>
                          </span>
                          <span class="ct-arrow" aria-hidden="true">→</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                  {rest.length > LIST && (
                    <button type="button" class="ct-toggle" onClick={() => setMore(!more)} aria-expanded={more}>
                      {more ? 'Mostrar menos' : `Mostrar mais ${rest.length - LIST} artigos`}
                    </button>
                  )}
                </div>
              ) : (
                <div class="ct-index ct-note">
                  <span class="ct-index-label">Em breve</span>
                  <p>{T.note}</p>
                  <a class="ct-btn ct-btn-ghost" href={notify(T.key.toLowerCase())} target="_blank" rel="noopener noreferrer">Quero ser avisado <span aria-hidden="true">→</span></a>
                </div>
              )}
            </>
          )}
        </div>

        <footer class="ct-foot">
          <span class="ct-brand">Realize Human<i>.</i></span>
          <span>Consultoria de RH estratégico · Comunicação consciente · Relações humanas</span>
        </footer>
      </div>

      {/* capa que acompanha o cursor no índice (desktop) */}
      <div class={`ct-peek${hover ? ' is-on' : ''}`} ref={peek} aria-hidden="true">
        {COVERS.map((a) => <img key={a.id} src={a.cover} alt="" width="720" height="450" loading="lazy" decoding="async" class={hover?.id === a.id ? 'is-on' : ''} />)}
      </div>
    </section>
  );
}
