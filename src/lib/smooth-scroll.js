import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';

/*
  Rolagem suave (Lenis).
  - Mouse/trackpad: a rolagem ganha inércia e desacelera suave, sem "degraus" da rodinha.
  - Toque (celular): continua nativa — o rolar do próprio sistema já é suave e responsivo.
  - Mesmo relógio do GSAP: Lenis roda dentro do ticker do GSAP, então rolagem e animações
    andam no MESMO quadro (sem dois loops disputando o navegador).
  - Quem pediu menos movimento no sistema: rolagem 1:1, sem suavização.
  - Pausa durante a tela de carregamento e com o "modo palco" aberto (window.__lenis).
*/

const html = document.documentElement;

const lenis = new Lenis({
  lerp: 0.09,                 // quanto menor, mais "flutuante"; 0.09 = suave sem parecer atrasado
  smoothWheel: true,
  wheelMultiplier: 0.9,
  anchors: { offset: 0 },     // links #metodo, #dobra3d… também deslizam
  autoRaf: false,
  respectReducedMotion: true,
});
window.__lenis = lenis;

gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);  // sem "pulos" de tempo: rolagem e animações nunca se separam

// trava enquanto a tela de carregamento estiver aberta
if (html.classList.contains('is-loading') && !html.classList.contains('site-go')) {
  lenis.stop();
  addEventListener('site:go', () => lenis.start(), { once: true });
}
