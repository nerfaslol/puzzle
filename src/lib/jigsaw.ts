export interface PuzzleOptions {
  widthMm: number
  heightMm: number
  rows: number
  cols: number
  seed: number
  /** Profundidade da orelha, fração do comprimento da aresta da peça (0.15–0.4 fica bem). */
  tabSize: number
  /** Aleatoriedade da posição/tamanho/profundidade da orelha (0–1). */
  jitter: number
  /** Cor do traçado no SVG (o valor não afeta o corte, é só visual/preview). */
  strokeColor?: string
  /** Espessura do traçado em mm (só visual — a máquina a laser trata qualquer path fechado/aberto como linha de corte). */
  strokeWidthMm?: number
}

export interface GeneratedPuzzle {
  svg: string
  widthMm: number
  heightMm: number
}

type Point = [number, number]
type Rng = () => number

/** PRNG determinístico (mulberry32) — mesma seed sempre gera o mesmo padrão. */
function mulberry32(seed: number) {
  let a = seed
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uniform(rng: Rng, min: number, max: number) {
  return rng() * (max - min) + min
}

function fmt(p: Point) {
  return `${p[0].toFixed(3)},${p[1].toFixed(3)}`
}

/**
 * Gera uma linha de corte completa (todas as células de uma linha/coluna interna) como um único
 * path contínuo, no estilo clássico de quebra-cabeça: uma leve ondulação na base, pescoço
 * estreito e bulbo redondo que "transborda" sobre o pescoço (undercut).
 *
 * O formato vem do esquema consagrado de 3 Beziers cúbicas por aresta (usado em geradores de
 * jigsaw para corte a laser), com parâmetro `t` controlando as proporções: pescoço = 2t,
 * largura do bulbo = 4t e profundidade = 3t — são essas proporções (bulbo mais largo que o
 * pescoço) que dão a cara de quebra-cabeça de verdade. `a..e` são jitters aleatórios; `a` de
 * cada segmento é herdado do `e` do anterior para a ondulação atravessar o canto suavemente.
 *
 * Importante: a profundidade escala com a dimensão PERPENDICULAR da célula (`segDepth`), não com
 * o comprimento da aresta — em grades não quadradas isso mantém a orelha proporcional à peça.
 */
function generateLine(
  segments: number,
  segLen: number,
  segDepth: number,
  fixed: number,
  horizontal: boolean,
  rng: Rng,
  t: number,
  j: number,
): string {
  let flip = rng() < 0.5
  let a = uniform(rng, -j, j)
  let e = 0

  let d = ""
  for (let i = 0; i < segments; i++) {
    if (i > 0) {
      const flipOld = flip
      flip = rng() < 0.5
      a = flip === flipOld ? -e : e
    }
    const b = uniform(rng, -j, j)
    const c = uniform(rng, -j, j)
    const dd = uniform(rng, -j, j)
    e = uniform(rng, -j, j)

    const x0 = i * segLen
    const sign = flip ? -1 : 1
    const P = (fl: number, fw: number): Point => {
      const l = x0 + fl * segLen
      const w = sign * fw * segDepth
      return horizontal ? [l, fixed + w] : [fixed + w, l]
    }

    const p0 = P(0, 0)
    const p1 = P(0.2, a)
    const p2 = P(0.5 + b + dd, -t + c)
    const p3 = P(0.5 - t + b, t + c)
    const p4 = P(0.5 - 2 * t + b - dd, 3 * t + c)
    const p5 = P(0.5 + 2 * t + b - dd, 3 * t + c)
    const p6 = P(0.5 + t + b, t + c)
    const p7 = P(0.5 + b + dd, -t + c)
    const p8 = P(0.8, e)
    const p9 = P(1, 0)

    if (i === 0) d += `M ${fmt(p0)} `
    d += `C ${fmt(p1)} ${fmt(p2)} ${fmt(p3)} C ${fmt(p4)} ${fmt(p5)} ${fmt(p6)} C ${fmt(p7)} ${fmt(p8)} ${fmt(p9)} `
  }
  return d
}

export function generatePuzzle(opts: PuzzleOptions): GeneratedPuzzle {
  const {
    widthMm,
    heightMm,
    rows,
    cols,
    seed,
    tabSize,
    jitter,
    strokeColor = "#111111",
    strokeWidthMm = 0.3,
  } = opts
  const rng = mulberry32(seed)
  const cellW = widthMm / cols
  const cellH = heightMm / rows

  // tabSize da UI é a profundidade total da orelha (fração da célula); no esquema de pontos a
  // profundidade é 3t, então t = tabSize / 3. O jitter da UI (0–1) vira offset máximo de ±10%.
  const t = tabSize / 3
  const j = jitter * 0.1

  const paths: string[] = []

  // Linhas horizontais internas (uma por divisão de linhas), cada uma um path contínuo.
  for (let r = 1; r < rows; r++) {
    paths.push(generateLine(cols, cellW, cellH, r * cellH, true, rng, t, j))
  }

  // Linhas verticais internas (uma por divisão de colunas).
  for (let c = 1; c < cols; c++) {
    paths.push(generateLine(rows, cellH, cellW, c * cellW, false, rng, t, j))
  }

  const border = `M 0,0 L ${widthMm},0 L ${widthMm},${heightMm} L 0,${heightMm} Z`
  const d = [border, ...paths].join(" ")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidthMm}" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
</svg>`

  return { svg, widthMm, heightMm }
}
