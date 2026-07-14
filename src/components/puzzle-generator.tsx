import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Dices,
  Download,
  ExternalLink,
  ImagePlus,
  Monitor,
  Moon,
  RotateCcw,
  Ruler,
  Scissors,
  Sun,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { generatePuzzle } from "@/lib/jigsaw"
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings"
import { applyTheme, readTheme, saveTheme, type Theme } from "@/lib/theme"

const GITHUB_URL = "https://github.com/nerfaslol/puzzle"

const STROKE_PRESETS = [
  { label: "Preto", value: "#111111" },
  { label: "Branco", value: "#ffffff" },
  { label: "Vermelho", value: "#e11d2e" },
  { label: "Azul", value: "#1d4ed8" },
]

const THEME_OPTIONS = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
] as const satisfies readonly { value: Theme; label: string; Icon: typeof Monitor }[]

const HEX_RE = /^#[0-9a-f]{6}$/i

const MIN_SAFE_PIECE_MM = 15

/**
 * Teto da grade. 100×100 já são 10.000 peças (SVG de ~2,8 MB) — bem além de qualquer uso real de
 * corte. O limite existe porque o preview reserializa o SVG inteiro no DOM a cada mudança: a 200×200
 * o arquivo passa de 11 MB e a aba congela.
 */
const MAX_GRID = 100

/**
 * Converte o texto do input em número clampado. Os inputs guardam string livre e o clamp só
 * acontece aqui (na geração) e no blur — nunca no onChange, senão digitar "12" trava no "1".
 */
function parseClamped(raw: string, min: number, max: number, fallback: number): number {
  const n = parseFloat(raw.replace(",", "."))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Enter confirma o valor (dispara o blur, que reescreve o input já clampado). */
function commitOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.currentTarget.blur()
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

function SliderField({
  label,
  display,
  ...sliderProps
}: {
  label: string
  display: string
} & React.ComponentProps<typeof Slider>) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{display}</span>
      </div>
      <Slider {...sliderProps} />
    </div>
  )
}

export function PuzzleGenerator() {
  // Lazy init: lê o localStorage uma única vez, na montagem.
  const [stored] = useState(loadSettings)

  const [widthStr, setWidthStr] = useState(stored.width)
  const [heightStr, setHeightStr] = useState(stored.height)
  const [colsStr, setColsStr] = useState(stored.cols)
  const [rowsStr, setRowsStr] = useState(stored.rows)
  const [seedStr, setSeedStr] = useState(stored.seed)
  const [strokeWidthStr, setStrokeWidthStr] = useState(stored.strokeWidth)
  const [tabSize, setTabSize] = useState(stored.tabSize)
  const [jitter, setJitter] = useState(stored.jitter)
  const [strokeColor, setStrokeColor] = useState(stored.strokeColor)
  // Rascunho do campo hex: o usuário digita caractere a caractere, e "#11" não é uma cor válida.
  // Só promove para `strokeColor` quando fecha um hex completo.
  const [hexDraft, setHexDraft] = useState(stored.strokeColor)

  const [theme, setTheme] = useState<Theme>(readTheme)
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoAspect, setPhotoAspect] = useState<number | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [aspectMode, setAspectMode] = useState<"photo" | "free">("free")
  // Pan/zoom da foto no preview: deslocamento em px do preview e escala sobre o object-cover.
  const [photoTransform, setPhotoTransform] = useState({ x: 0, y: 0, scale: 1 })

  const photoInputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    baseX: number
    baseY: number
  } | null>(null)

  const widthMm = parseClamped(widthStr, 10, 5000, 300)
  const lockToPhoto = aspectMode === "photo" && photoAspect !== null
  // Com a proporção travada na foto, a altura é derivada da largura (só afeta preview/medidas).
  // Clamp também aqui: uma foto panorâmica extrema poderia derivar altura fora dos limites.
  const heightMm = lockToPhoto
    ? Math.min(5000, Math.max(10, Math.round((widthMm / photoAspect) * 10) / 10))
    : parseClamped(heightStr, 10, 5000, 200)
  const cols = Math.round(parseClamped(colsStr, 2, MAX_GRID, 12))
  const rows = Math.round(parseClamped(rowsStr, 2, MAX_GRID, 8))
  const seed = Math.round(parseClamped(seedStr, 0, 999_999_999, 0))
  const strokeWidthMm = parseClamped(strokeWidthStr, 0.05, 5, 1)

  const params = useMemo(
    () => ({ widthMm, heightMm, rows, cols, seed, tabSize, jitter, strokeColor, strokeWidthMm }),
    [widthMm, heightMm, rows, cols, seed, tabSize, jitter, strokeColor, strokeWidthMm],
  )

  // Grades grandes geram SVGs de megabytes, e o preview reinjeta o markup inteiro no DOM. Sem o
  // defer, cada tecla digitada bloqueia a thread durante a geração + parse. Com ele, os inputs
  // respondem na hora e o preview alcança depois (`isStale` sinaliza isso visualmente).
  const deferredParams = useDeferredValue(params)
  const puzzle = useMemo(() => generatePuzzle(deferredParams), [deferredParams])
  const isStale = params !== deferredParams

  const pieceCount = rows * cols
  const pieceW = widthMm / cols
  const pieceH = heightMm / rows
  const tooSmall = pieceW < MIN_SAFE_PIECE_MM || pieceH < MIN_SAFE_PIECE_MM

  // Persiste os parâmetros a cada mudança. A foto fica de fora — ver comentário em settings.ts.
  useEffect(() => {
    saveSettings({
      width: widthStr,
      height: heightStr,
      cols: colsStr,
      rows: rowsStr,
      seed: seedStr,
      strokeWidth: strokeWidthStr,
      tabSize,
      jitter,
      strokeColor,
    })
  }, [widthStr, heightStr, colsStr, rowsStr, seedStr, strokeWidthStr, tabSize, jitter, strokeColor])

  // Reespelha o campo hex quando a cor muda por fora dele (preset, seletor nativo, reset).
  useEffect(() => setHexDraft(strokeColor), [strokeColor])

  // Em "system" o tema precisa continuar seguindo o SO enquanto a aba estiver aberta, então
  // ficamos escutando o matchMedia; nos temas fixos não há nada para observar.
  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => applyTheme("system")
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [theme])

  function onHexChange(raw: string) {
    const next = raw.startsWith("#") ? raw : `#${raw}`
    setHexDraft(next)
    if (HEX_RE.test(next)) setStrokeColor(next.toLowerCase())
  }

  function resetSettings() {
    const d = DEFAULT_SETTINGS
    setWidthStr(d.width)
    setHeightStr(d.height)
    setColsStr(d.cols)
    setRowsStr(d.rows)
    setSeedStr(d.seed)
    setStrokeWidthStr(d.strokeWidth)
    setTabSize(d.tabSize)
    setJitter(d.jitter)
    setStrokeColor(d.strokeColor)
    clearSettings()
  }

  function randomizeSeed() {
    setSeedStr(String(Math.floor(Math.random() * 1_000_000)))
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Zera o input antes de qualquer return: sem isso, reescolher o MESMO arquivo não dispara change.
    e.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setPhotoError("Esse arquivo não é uma imagem.")
      return
    }

    const reader = new FileReader()
    reader.onerror = () => setPhotoError("Não foi possível ler o arquivo.")
    reader.onload = () => {
      const url = reader.result
      if (typeof url !== "string") {
        setPhotoError("Não foi possível ler o arquivo.")
        return
      }
      const img = new Image()
      // A foto só é publicada depois de decodificar. Um arquivo corrompido (ou com extensão
      // mentindo sobre o tipo) viraria um <img> quebrado sobre a chapa, e o aspect sairia NaN.
      img.onload = () => {
        const aspect = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : NaN
        if (!Number.isFinite(aspect) || aspect <= 0) {
          setPhotoError("Imagem inválida.")
          return
        }
        setPhotoAspect(aspect)
        setPhoto(url)
        setAspectMode("photo")
        setPhotoTransform({ x: 0, y: 0, scale: 1 })
        setPhotoError(null)
      }
      img.onerror = () => setPhotoError("Imagem inválida ou corrompida.")
      img.src = url
    }
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoAspect(null)
    setPhotoError(null)
    setAspectMode("free")
    setPhotoTransform({ x: 0, y: 0, scale: 1 })
  }

  function onSheetPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!photo) return
    e.preventDefault()
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: photoTransform.x,
      baseY: photoTransform.y,
    }
    // Captura o ponteiro pra continuar arrastando mesmo saindo da chapa; pode lançar se o
    // ponteiro já não existir mais — sem captura o arrasto ainda funciona dentro do elemento.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* segue sem captura */
    }
  }

  function onSheetPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    setPhotoTransform((t) => ({ ...t, x: drag.baseX + dx, y: drag.baseY + dy }))
  }

  function onSheetPointerUp() {
    dragRef.current = null
  }

  // Zoom com a roda do mouse. Listener nativo com passive: false — o onWheel do React é
  // registrado como passive e o preventDefault (necessário pra não rolar a página) não funciona.
  useEffect(() => {
    const el = sheetRef.current
    if (!el || !photo) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setPhotoTransform((t) => ({ ...t, scale: Math.min(6, Math.max(0.2, t.scale * factor)) }))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [photo])

  function downloadSvg() {
    // O arquivo baixado sai sempre com linha fina preta (0,1 mm), padrão para corte a laser —
    // cor/espessura do preview são só visuais. Traço grosso em alguns softwares vira contorno
    // com duas bordas paralelas ("linha dupla"), o que duplicaria o corte.
    const cutFile = generatePuzzle({
      widthMm,
      heightMm,
      rows,
      cols,
      seed,
      tabSize,
      jitter,
      strokeColor: "#000000",
      strokeWidthMm: 0.1,
    })
    const blob = new Blob([cutFile.svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `quebra-cabeca-${cols}x${rows}-${widthMm}x${heightMm}mm.svg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full flex-col gap-3 border-b bg-background p-4 lg:h-svh lg:w-[320px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Section title="Chapa">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largura (mm)" htmlFor="width">
              <Input
                id="width"
                inputMode="decimal"
                className="h-9 tabular-nums"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                onBlur={() => setWidthStr(String(widthMm))}
                onKeyDown={commitOnEnter}
              />
            </Field>
            <Field label="Altura (mm)" htmlFor="height">
              <Input
                id="height"
                inputMode="decimal"
                className="h-9 tabular-nums"
                value={lockToPhoto ? String(heightMm) : heightStr}
                disabled={lockToPhoto}
                title={lockToPhoto ? "Altura calculada pela proporção da foto" : undefined}
                onChange={(e) => setHeightStr(e.target.value)}
                onBlur={() => setHeightStr(String(heightMm))}
                onKeyDown={commitOnEnter}
              />
            </Field>
            <Field label="Colunas" htmlFor="cols">
              <Input
                id="cols"
                inputMode="numeric"
                className="h-9 tabular-nums"
                value={colsStr}
                onChange={(e) => setColsStr(e.target.value)}
                onBlur={() => setColsStr(String(cols))}
                onKeyDown={commitOnEnter}
              />
            </Field>
            <Field label="Linhas" htmlFor="rows">
              <Input
                id="rows"
                inputMode="numeric"
                className="h-9 tabular-nums"
                value={rowsStr}
                onChange={(e) => setRowsStr(e.target.value)}
                onBlur={() => setRowsStr(String(rows))}
                onKeyDown={commitOnEnter}
              />
            </Field>
          </div>

          {tooSmall ? (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                {pieceCount} peças de {pieceW.toFixed(1)} × {pieceH.toFixed(1)} mm — abaixo de{" "}
                {MIN_SAFE_PIECE_MM} mm ficam frágeis no corte.
              </span>
            </p>
          ) : (
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {pieceCount} peças de {pieceW.toFixed(1)} × {pieceH.toFixed(1)} mm
            </p>
          )}
        </Section>

        <Separator />

        <Section title="Padrão">
          <div className="grid grid-cols-2 gap-3">
            {/* Máximo 0.35: com 0.4 + aleatoriedade alta, orelhas de linhas vizinhas viradas uma
                para a outra podiam se tocar (profundidade + jitter somando ~1 célula). */}
            <SliderField
              label="Orelha"
              display={`${Math.round(tabSize * 100)}%`}
              value={[tabSize]}
              min={0.15}
              max={0.35}
              step={0.01}
              onValueChange={(v) => setTabSize(Array.isArray(v) ? v[0] : v)}
            />
            <SliderField
              label="Aleatoriedade"
              display={`${Math.round(jitter * 100)}%`}
              value={[jitter]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(v) => setJitter(Array.isArray(v) ? v[0] : v)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="seed" className="text-xs font-medium">
              Seed
            </Label>
            <Input
              id="seed"
              inputMode="numeric"
              title="A mesma seed sempre gera o mesmo recorte."
              className="h-9 flex-1 tabular-nums"
              value={seedStr}
              onChange={(e) => setSeedStr(e.target.value)}
              onBlur={() => setSeedStr(String(seed))}
              onKeyDown={commitOnEnter}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              onClick={randomizeSeed}
              aria-label="Sortear novo padrão"
              title="Sortear novo padrão"
            >
              <Dices />
            </Button>
          </div>
        </Section>

        <Separator />

        <Section title="Referência">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPhotoSelected}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1"
              title="A foto aparece sob as linhas no preview. Fica só no seu navegador — não entra no SVG nem sai do computador."
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus />
              {photo ? "Trocar foto" : "Foto de referência"}
            </Button>
            {photo && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                onClick={removePhoto}
                aria-label="Remover foto"
                title="Remover foto"
              >
                <X />
              </Button>
            )}
          </div>

          {photoError && (
            <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] leading-snug text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>{photoError}</span>
            </p>
          )}

          {photo && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  { mode: "photo", label: "Proporção da foto" },
                  { mode: "free", label: "Livre" },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAspectMode(mode)}
                  aria-pressed={aspectMode === mode}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    aspectMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </Section>

        <Separator />

        <Section title="Traço">
          {/* Padrão de mercado pra escolher cor: atalhos de preset + swatch que abre o seletor do
              SO + campo hex editável (os três editam o mesmo valor). O <input type="color"> nativo
              ignora border-radius e desenha uma moldura própria, então ele fica invisível por cima
              do swatch — que é quem realmente aparece. */}
          <div className="flex items-center gap-1.5">
            {STROKE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={`Cor ${preset.label}`}
                aria-pressed={strokeColor === preset.value}
                title={preset.label}
                onClick={() => setStrokeColor(preset.value)}
                className={cn(
                  "size-6 shrink-0 rounded-full ring-1 ring-foreground/25 transition hover:scale-110",
                  strokeColor === preset.value &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundColor: preset.value }}
              />
            ))}

            <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

            {/* O ring usa foreground/25 em vez de `border`: uma cor escura (#111) sobre a sidebar
                escura fica indistinguível com o ring padrão, que é branco a 10%. */}
            <label
              title="Escolher cor"
              className="relative size-8 shrink-0 cursor-pointer rounded-md ring-1 ring-foreground/25 transition hover:ring-2 hover:ring-primary"
              style={{ backgroundColor: strokeColor }}
            >
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                aria-label="Escolher cor"
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>

            <Input
              aria-label="Cor em hexadecimal"
              spellCheck={false}
              maxLength={7}
              className="h-8 min-w-0 flex-1 px-2 font-mono text-xs uppercase tabular-nums"
              value={hexDraft}
              onChange={(e) => onHexChange(e.target.value)}
              onBlur={() => setHexDraft(strokeColor)}
              onKeyDown={commitOnEnter}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="stroke-width" className="text-xs font-medium">
              Espessura
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="stroke-width"
                inputMode="decimal"
                title="Só afeta o preview."
                className="h-8 w-16 text-right tabular-nums"
                value={strokeWidthStr}
                onChange={(e) => setStrokeWidthStr(e.target.value)}
                onBlur={() => setStrokeWidthStr(String(strokeWidthMm))}
                onKeyDown={commitOnEnter}
              />
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            Só preview — o SVG sai com linha preta de 0,1 mm.
          </p>
        </Section>

        <div className="mt-auto flex flex-col gap-2 pt-3">
          <Button onClick={downloadSvg} className="h-10 w-full">
            <Download />
            Baixar SVG
          </Button>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Tema"
              className="flex flex-1 gap-1 rounded-lg bg-muted p-1"
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  title={`Tema: ${label}`}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors",
                    theme === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={resetSettings}
              aria-label="Restaurar padrões"
              title="Restaurar padrões"
            >
              <RotateCcw />
            </Button>
          </div>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver projeto no GitHub
            <ExternalLink className="size-3" />
          </a>
        </div>
      </aside>

      <main
        className="flex min-h-[60svh] flex-1 flex-col items-center justify-center gap-3 bg-canvas p-4 md:p-8"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--color-canvas-check) 25%, transparent 25%), linear-gradient(-45deg, var(--color-canvas-check) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-canvas-check) 75%), linear-gradient(-45deg, transparent 75%, var(--color-canvas-check) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium tabular-nums backdrop-blur">
            <Ruler className="size-3.5 text-muted-foreground" />
            {widthMm} × {heightMm} mm
          </span>
          <span className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium tabular-nums backdrop-blur">
            <Scissors className="size-3.5 text-muted-foreground" />
            {pieceCount} peças
          </span>
          {photo && (
            <>
              <span className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                arraste a foto · scroll = zoom ({Math.round(photoTransform.scale * 100)}%)
              </span>
              <button
                type="button"
                onClick={() => setPhotoTransform({ x: 0, y: 0, scale: 1 })}
                title="Recentralizar foto"
                className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur transition-colors hover:bg-background"
              >
                <RotateCcw className="size-3.5 text-muted-foreground" />
                Recentralizar
              </button>
            </>
          )}
        </div>
        <div
          ref={sheetRef}
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          className={cn(
            "relative overflow-hidden bg-white shadow-xl ring-1 ring-black/10 transition-opacity",
            photo && "cursor-grab touch-none select-none active:cursor-grabbing",
            isStale && "opacity-60",
          )}
          style={{
            width: `min(100%, calc(75svh * ${(widthMm / heightMm).toFixed(4)}))`,
          }}
        >
          {photo && (
            <img
              src={photo}
              alt="Imagem de referência do quebra-cabeça"
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full object-cover will-change-transform"
              style={{
                transform: `translate(${photoTransform.x}px, ${photoTransform.y}px) scale(${photoTransform.scale})`,
              }}
            />
          )}
          <div
            className="pointer-events-none relative [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: puzzle.svg }}
          />
        </div>
      </main>
    </div>
  )
}
