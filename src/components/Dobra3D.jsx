import { useEffect, useRef } from 'preact/hooks';
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
 * Segunda dobra. Hidratada com `client:visible`: este componente (e, a partir dele,
 * o three.js + o modelo) só é baixado quando a dobra se aproxima da tela.
 */
export default function Dobra3D() {
  const root = useRef(null);

  useEffect(() => {
    let dispose;
    let cancelled = false;
    // segundo nível de "lazy": o three.js (~180 KB gzip) vem num chunk separado
    import('../lib/dobra3d-scene.js').then(({ initDobra3D }) => {
      if (!cancelled) dispose = initDobra3D(root.current);
    });
    return () => { cancelled = true; dispose?.(); };
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
                {s.cta && <><br /><a class="t3d-cta" href={WA} target="_blank" rel="noopener">AGENDE UMA CONVERSA →</a></>}
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
