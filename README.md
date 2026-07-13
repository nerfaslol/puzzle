# 🧩 Gerador de Quebra-Cabeça para Corte a Laser

Gera padrões de corte de quebra-cabeça (jigsaw) em **SVG com escala real (mm)**, prontos para
máquinas de corte a laser (LightBurn, Inkscape, etc.).

**➜ Usar online: https://nerfaslol.github.io/puzzle/**

## Recursos

- Dimensões da chapa em milímetros — o SVG abre em escala física correta no software de corte
- Grade de peças configurável (colunas × linhas), com aviso quando as peças ficam frágeis demais
- Encaixes clássicos (bulbo + pescoço) com tamanho e aleatoriedade ajustáveis
- Seed determinística — a mesma seed sempre reproduz o mesmo padrão
- Foto de referência sob as linhas no preview (fica só no navegador) e trava de proporção
- Tema claro/escuro
- SVG otimizado para laser: um único `<path>`, linhas contínuas, **zero segmentos duplicados**,
  traço fino de 0,1 mm no arquivo baixado

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # type-check + build de produção
npm run lint     # oxlint
```

Stack: Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui.
Deploy automático no GitHub Pages a cada push na `main`.
