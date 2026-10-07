import {
  HalfFloatType, Mesh, NeutralToneMapping, OrthographicCamera, PMREMGenerator, PerspectiveCamera, SRGBColorSpace, WebGLRenderTarget, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/*
  O WebGL do site (um só contexto, criado sob demanda pela dobra 3D).
  A tela de carregamento não usa mais WebGL (o logo dela são imagens), então a dobra 3D
  é a dona do canvas desde o começo.
*/

let shared = null;

export function getGL() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // antialias off: a dobra 3D suaviza as bordas nas próprias texturas (MSAA)
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  shared = { canvas, renderer, owner: null, env: null };
  return shared;
}

/**
 * Ambiente de reflexos (vidro, verniz), gerado uma vez. Promise<Texture>.
 *
 * Gerar o PMREM direto (pmrem.fromScene) travava a página ~1 s: os shaders de desfoque dele são
 * compilados no primeiro uso e a página fica parada esperando a placa de vídeo. Aqui eles são
 * compilados ANTES, em paralelo (compileAsync — a página continua respondendo), e a geração em si
 * vira só desenho.
 * (Usa partes internas do PMREMGenerator do three r0.180: _setSize/_allocateTargets/_lodPlanes/
 * _blurMaterial. Se atualizar o three, conferir.)
 */
let envPromise = null;
export function getEnv() {
  envPromise ??= (async () => {
    await new Promise((r) => setTimeout(r, 0));   // fora da tarefa que avalia o three.js
    const { renderer } = getGL();
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();

    // cria o material de desfoque no tamanho que o fromScene vai usar (256, o padrão)
    pmrem._setSize(256);
    pmrem._allocateTargets().dispose();

    // compila na mesma variante do uso real: desenhando numa textura de meia precisão
    const rt = new WebGLRenderTarget(16, 16, { type: HalfFloatType });
    renderer.setRenderTarget(rt);
    await renderer.compileAsync(room, new PerspectiveCamera(90, 1, 0.1, 100));
    await renderer.compileAsync(new Mesh(pmrem._lodPlanes[0], pmrem._blurMaterial), new OrthographicCamera());
    renderer.setRenderTarget(null);
    rt.dispose();

    const env = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    room.dispose();
    getGL().env = env;
    return env;
  })();
  return envPromise;
}
