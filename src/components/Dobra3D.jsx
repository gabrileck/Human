import { useEffect, useRef } from 'preact/hooks';
import { getModelBuffer } from '../lib/model-buffer.js';
import '../styles/dobra3d.css';

const WA = 'https://wa.me/5541997135842';

// Uma camada de texto por cena — a ordem bate com STAGES em lib/dobra3d-scene.js
const SCENES = [
  {
    eyebrow: '01 — Sobre nós',
    title: ['Empresa', 'não cresce', 'no improviso'],
    label: '15+ anos · 500+ líderes',
    text: 'A Realize Human foi criada para resolver um problema que a maioria das empresas tem, mas poucos nomeiam: decisões erradas sobre pessoas.',
  },
  {
    eyebrow: '02 — Reconhece alguma dessas situações?',
    title: ['Tem', 'problema', 'de pessoas'],
    label: 'Sinais de alerta',
    text: 'Contrata alguém que parecia perfeito e em três meses está demitindo. Tem gerentes, mas não tem líderes de verdade. Decide sobre pessoas por feeling — e paga caro depois.',
  },
  {
    eyebrow: '03 — Consequência direta',
    title: ['O dono', 'vira o', 'gargalo'],
    label: 'Resultado',
    text: 'Perde dinheiro, perde tempo, perde os melhores profissionais. E o crescimento que deveria ser previsível vira improviso.',
  },
  {
    eyebrow: '04 — Estratégia e clareza',
    title: ['Com método,', 'não com', 'achismo'],
    label: 'Como atuamos',
    text: 'Dentro das empresas, ajudando líderes a tomarem decisões mais inteligentes sobre pessoas. Sem soluções genéricas.',
    cta: true,
  },
];

/**
 * Segunda dobra. O componente é minúsculo; o pesado (three.js ~150 KB gzip + montagem da
 * cena) só começa na PRIMEIRA INTERAÇÃO da pessoa (mexer o mouse, rolar, tocar, teclar).
 * Assim a abertura da página não executa nada de 3D — e, como a dobra fica uma tela abaixo,
 * dá tempo de ela estar pronta quando a pessoa chegar.
 */
const TRIGGERS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'];

export default function Dobra3D() {
  const root = useRef(null);

  useEffect(() => {
    let dispose;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      TRIGGERS.forEach((ev) => removeEventListener(ev, start));
      import('../lib/dobra3d-scene.js').then(({ initDobra3D }) => {
        if (!cancelled) dispose = initDobra3D(root.current);
      });
    };
    TRIGGERS.forEach((ev) => addEventListener(ev, start, { passive: true }));
    // o modelo (.glb) é só baixado logo depois da abertura, com a rede livre — fora do
    // caminho das imagens da 1ª dobra, mas pronto antes de a pessoa chegar na dobra 3D
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300));
    const prefetch = () => idle(() => getModelBuffer().catch(() => {}), { timeout: 3000 });
    if (document.documentElement.classList.contains('site-go')) prefetch();
    else addEventListener('site:go', prefetch, { once: true });
    // já abriu rolado para baixo (voltar/atualizar a página no meio) ou com ?p= (abre direto
    // num ponto da dobra 3D, para testes): começa logo
    if (scrollY > 0 || new URLSearchParams(location.search).has('p')) start();
    return () => { cancelled = true; TRIGGERS.forEach((ev) => removeEventListener(ev, start)); removeEventListener('site:go', prefetch); dispose?.(); };
  }, []);

  return (
    <section class="t3d" id="dobra3d" ref={root}>
      <div class="t3d-sticky">
        <canvas class="t3d-canvas" id="t3d-gl" />

        {SCENES.map((s) => (
          <div class="t3d-layer" key={s.eyebrow}>
            <div class="t3d-inner">
              <span class="t3d-eyebrow">{s.eyebrow}</span>
              <h2 class="t3d-title">
                {s.title.map((line, i) => <span key={line}>{i > 0 && <br />}{line}</span>)}
              </h2>
              <p class="t3d-desc">
                <b>{s.label}</b>{s.text}
                {s.cta && <><br /><a class="t3d-cta" href={WA} target="_blank" rel="noopener noreferrer">AGENDE UMA CONVERSA →</a></>}
              </p>
            </div>
          </div>
        ))}

        <div class="t3d-hud">
          <span class="num" id="t3d-num">01 / 04</span>
          <span id="t3d-name">Sobre nós</span>
          <span class="bar"><span id="t3d-bar" /></span>
          <span class="hint" id="t3d-hint">Role ↓</span>
        </div>

        <div class="t3d-loader" id="t3d-loader">CARREGANDO <span id="t3d-pct">&nbsp;0%</span></div>
      </div>
    </section>
  );
}
