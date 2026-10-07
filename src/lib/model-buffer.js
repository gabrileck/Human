// Baixa o logo-3d.glb UMA vez por página e compartilha o resultado.
// O download antecipado (Dobra3D.jsx, logo depois da abertura) e a cena 3D pedem o mesmo arquivo:
// quem chegar primeiro baixa, o outro recebe o mesmo ArrayBuffer. Não importa o three.js — é leve.

export const MODEL_URL = `${import.meta.env.BASE_URL}assets/logo-3d.glb`;

let request = null;
let progress = 0;
const listeners = new Set();
const emit = (p) => { progress = p; listeners.forEach((fn) => fn(p)); };

/** Promise<ArrayBuffer>. `onProgress(0..1)` recebe o andamento do download. */
export function getModelBuffer(onProgress) {
  if (onProgress) { listeners.add(onProgress); onProgress(progress); }
  request ??= (async () => {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`logo-3d.glb: HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !total) { const buf = await res.arrayBuffer(); emit(1); return buf; }

    // lê em pedaços para conseguir mostrar a porcentagem real
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      emit(Math.min(received / total, 1));
    }
    const out = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    emit(1);
    return out.buffer;
  })();
  return request;
}
