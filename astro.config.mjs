// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  // Preact: mesmo JSX/hooks do React, com ~4 KB de runtime no lugar de ~66 KB
  integrations: [preact()],

  // CSP com hashes gerados no build: só os scripts/estilos do próprio site executam.
  // 'wasm-unsafe-eval' e blob: são exigidos pelo decodificador meshopt e pelas texturas do GLB.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' blob: data:",
        "worker-src 'self' blob:",
        "media-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      styleDirective: { resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },

  build: {
    // o CSS (~12 KB) vai embutido no HTML: uma requisição a menos bloqueando o primeiro desenho
    inlineStylesheets: 'always',
  },

  // Fontes servidas pelo próprio site (sem ir ao Google em tempo de execução), só o
  // subconjunto latino, com fallbacks de métrica ajustada para o texto não "pular" ao carregar.
  fonts: [
    { provider: fontProviders.google(), name: 'Instrument Serif', cssVariable: '--font-serif', weights: [400], styles: ['normal', 'italic'], subsets: ['latin'], fallbacks: ['serif'] },
    { provider: fontProviders.google(), name: 'Manrope', cssVariable: '--font-sans', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'Montserrat', cssVariable: '--font-display', weights: [900], styles: ['normal', 'italic'], subsets: ['latin'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'JetBrains Mono', cssVariable: '--font-mono', weights: [400, 500], styles: ['normal'], subsets: ['latin'], fallbacks: ['monospace'] },
    { provider: fontProviders.google(), name: 'Space Grotesk', cssVariable: '--font-grotesk', weights: [500], styles: ['normal'], subsets: ['latin'], fallbacks: ['sans-serif'] },
  ],

  vite: {
    // o chunk do three.js (~150 KB gzip) é carregado sob demanda na 2ª dobra; o aviso não se aplica
    build: { chunkSizeWarningLimit: 700 },
  },
});
