import { NeutralToneMapping, PMREMGenerator, SRGBColorSpace, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/*
  UM único WebGL para o site inteiro.
  A tela de carregamento e a dobra 3D usam o mesmo renderer/canvas: primeiro a tela de
  carregamento desenha nele; quando ela sai, o canvas é entregue para a dobra 3D.
  Ganhos (medidos): o ambiente de luz é gerado uma vez só, shaders em comum compilam uma
  vez só, e os dois não disputam a placa de vídeo — era isso que congelava a tela de
  carregamento por até 2 s no primeiro acesso.

  `owner` diz quem está desenhando no canvas agora ('loader' | 'dobra3d' | null).
  Quem libera chama `handoff()`, que avisa com o evento `gl:handoff`.
*/

let shared = null;

export function getGL() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // alpha: a tela de carregamento é transparente sobre o fundo em CSS;
  // antialias off: a dobra 3D suaviza as bordas nas próprias texturas (MSAA).
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;

  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // reflexos (vidro, verniz)
  pmrem.dispose();

  // a tela de carregamento reserva o canvas assim que começa (window.__glReserved),
  // antes mesmo do three.js chegar — senão a dobra 3D poderia pegá-lo primeiro
  shared = { canvas, renderer, env, owner: window.__glReserved ? 'loader' : null };
  window.__glShared = shared;
  return shared;
}

/** Quem estava usando o canvas devolve; o próximo dono assume no evento `gl:handoff`. */
export function handoff() {
  window.__glReserved = false;
  if (!shared) return;
  shared.owner = null;
  window.dispatchEvent(new Event('gl:handoff'));
}
