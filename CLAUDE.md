# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

- `npm run dev` — inicia o servidor de desenvolvimento Vite (porta 5173).
- `npm run build` — type-check (`tsc -b`) seguido de `vite build`. Ambos precisam passar sem erro.
- `npm run preview` — serve o build de produção localmente.
- `npm run lint` — roda o `oxlint` (não usa ESLint).
- `npx shadcn@latest add <componente>` — adiciona um novo componente shadcn/ui em `src/components/ui`.

Não há suíte de testes configurada neste projeto.

## Deploy (GitHub Pages)

- Site publicado em **https://nerfaslol.github.io/puzzle/** (repo `nerfaslol/puzzle`, público).
- Deploy automático via GitHub Actions (`.github/workflows/deploy.yml`) a cada push na `main`; Pages configurado com source "GitHub Actions".
- `vite.config.ts` tem `base: "/puzzle/"` — obrigatório para os assets funcionarem no subpath do Pages; se o repo for renomeado, atualizar o `base` junto.
- O CI usa `npm install` (não `npm ci`): o lock é gerado no Windows e o npm omite deps opcionais transitivas de outra plataforma (bug npm/cli#4828), o que quebra `npm ci` no Linux. Não "corrigir" de volta para `npm ci` sem resolver isso.

## Stack e arquitetura

- **Vite 8 + React 19 + TypeScript**, sem React Compiler habilitado.
- **Tailwind CSS v4** via `@tailwindcss/vite` (plugin do Vite, não PostCSS). Estilos globais e tokens de tema (cores em `oklch`, radius, sidebar, charts) ficam em `src/index.css` via `@theme inline` e `@layer base` — não existe `tailwind.config.js`.
- **shadcn/ui**, estilo `base-nova`, ícones via `lucide-react`, configurado em `components.json`. Alias de import `@/*` aponta para `src/*` (configurado em `tsconfig.json`, `tsconfig.app.json` e `vite.config.ts` — os três precisam ficar em sincronia se o alias mudar).
  - `@/components/ui` — componentes shadcn (gerados pelo CLI; tratar como código gerado, preferir `npx shadcn add` a editar manualmente quando for só customização de tema).
  - `@/lib/utils` — utilitário `cn()` (clsx + tailwind-merge) usado por todos os componentes ui.
- **Linting**: `oxlint` (não ESLint), config em `.oxlintrc.json` com plugins `react`, `typescript`, `oxc`.
- `tsconfig.app.json` usa `moduleResolution: "bundler"` — não adicionar `baseUrl` (TS 6+ trata como deprecated/erro nessa config); os path aliases funcionam só com `paths`.

## Domínio: gerador de quebra-cabeça para corte a laser

O app é um gerador de padrões de corte de quebra-cabeça (jigsaw) em SVG, em escala real (mm), para uso direto em máquinas de corte a laser (LightBurn, Inkscape, etc). Só gera as linhas de corte — sem imagem/gravação.

- `src/lib/jigsaw.ts` — algoritmo puro (sem dependência de React/DOM), função principal `generatePuzzle(opts): GeneratedPuzzle`.
  - PRNG determinístico (`mulberry32`, seedado): a mesma seed sempre reproduz o mesmo padrão.
  - Cada linha de corte interna (horizontal/vertical) é gerada **uma única vez** como um path contínuo compartilhado pelas peças dos dois lados — é isso que garante o encaixe perfeito. Não gerar arestas por peça individualmente.
  - A "orelha" usa o esquema clássico de geradores de jigsaw: 3 Beziers cúbicas por aresta com pontos de controle fixos parametrizados por `t` (pescoço = 2t, largura do bulbo = 4t, profundidade = 3t — o bulbo mais largo que o pescoço é o que dá o undercut/cara de quebra-cabeça) e jitters `a..e`; o `a` de cada segmento herda o `e` do anterior para a ondulação atravessar o canto suavemente. **Não** tentar substituir por spline genérica interpolando waypoints (Catmull-Rom etc.) — já foi tentado e produz bicos triangulares/bolhas no bulbo.
  - A profundidade da orelha escala com a dimensão **perpendicular** da célula (não com o comprimento da aresta) — em grades não quadradas isso mantém a orelha proporcional à peça.
  - O SVG de saída usa `width`/`height` em `mm` e `viewBox` nas mesmas unidades numéricas — isso é o que faz o arquivo abrir em escala física correta no software de corte. Manter essa correspondência ao alterar o gerador.
- `src/components/puzzle-generator.tsx` — formulário (dimensões, colunas/linhas, tamanho da orelha, aleatoriedade, seed) + preview ao vivo (recalculado via `useMemo`) + download do SVG (Blob, sem chamada de rede).
