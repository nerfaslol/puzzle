import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Dices,
  Download,
  ImagePlus,
  Moon,
  Puzzle,
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

const STROKE_PRESETS = [
  { label: "Preto", value: "#111111" },
  { label: "Branco", value: "#ffffff" },
  { label: "Vermelho", value: "#e11d2e" },
  { label: "Azul", value: "#1d4ed8" },
]

const MIN_SAFE_PIECE_MM = 15

/**
 * Converte o texto do input em número clampado. Os inputs guardam string livre e o clamp só
 * acontece aqui (na geração) e no blur — nunca no onChange, senão digitar "12" trava no "1".
 */
function parseClamped(raw: string, min: number, max: number, fallback: number): number {
  const n = parseFloat(raw.replace(",", "."))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs">
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
        <Label className="text-xs">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{display}</span>
      </div>
      <Slider {...sliderProps} />
    </div>
  )
}

export function PuzzleGenerator() {
  const [widthStr, setWidthStr] = useState("300")
  const [heightStr, setHeightStr] = useState("200")
  const [colsStr, setColsStr] = useState("6")
  const [rowsStr, setRowsStr] = useState("4")
  const [seedStr, setSeedStr] = useState("1234")
  const [strokeWidthStr, setStrokeWidthStr] = useState("0.3")
  const [tabSize, setTabSize] = useState(0.28)
  const [jitter, setJitter] = useState(0.6)
  const [strokeColor, setStrokeColor] = useState(STROKE_PRESETS[0].value)
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoAspect, setPhotoAspect] = useState<number | null>(null)
  const [aspectMode, setAspectMode] = useState<"photo" | "free">("free")
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  const photoInputRef = useRef<HTMLInputElement>(null)

  const widthMm = parseClamped(widthStr, 10, 5000, 300)
  const lockToPhoto = aspectMode === "photo" && photoAspect !== null
  // Com a proporção travada na foto, a altura é derivada da largura (só afeta preview/medidas).
  const heightMm = lockToPhoto
    ? Math.round((widthMm / photoAspect) * 10) / 10
    : parseClamped(heightStr, 10, 5000, 200)
  const cols = Math.round(parseClamped(colsStr, 2, 200, 6))
  const rows = Math.round(parseClamped(rowsStr, 2, 200, 4))
  const seed = Math.round(parseClamped(seedStr, 0, 999_999_999, 0))
  const strokeWidthMm = parseClamped(strokeWidthStr, 0.05, 5, 0.3)

  const puzzle = useMemo(
    () =>
      generatePuzzle({
        widthMm,
        heightMm,
        rows,
        cols,
        seed,
        tabSize,
        jitter,
        strokeColor,
        strokeWidthMm,
      }),
    [widthMm, heightMm, rows, cols, seed, tabSize, jitter, strokeColor, strokeWidthMm],
  )

  const pieceCount = rows * cols
  const pieceW = widthMm / cols
  const pieceH = heightMm / rows
  const tooSmall = pieceW < MIN_SAFE_PIECE_MM || pieceH < MIN_SAFE_PIECE_MM

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
    setDark(isDark)
  }

  function randomizeSeed() {
    setSeedStr(String(Math.floor(Math.random() * 1_000_000)))
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      const img = new Image()
      img.onload = () => {
        setPhotoAspect(img.naturalWidth / img.naturalHeight)
        setAspectMode("photo")
      }
      img.src = url
      setPhoto(url)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoAspect(null)
    setAspectMode("free")
  }

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
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
            <Puzzle className="size-3.5" />
          </div>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            Gerador de Quebra-Cabeça
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleTheme}
            title={dark ? "Tema claro" : "Tema escuro"}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <Field label="Largura (mm)" htmlFor="width">
            <Input
              id="width"
              inputMode="decimal"
              value={widthStr}
              onChange={(e) => setWidthStr(e.target.value)}
              onBlur={() => setWidthStr(String(widthMm))}
            />
          </Field>
          <Field label="Altura (mm)" htmlFor="height">
            <Input
              id="height"
              inputMode="decimal"
              value={lockToPhoto ? String(heightMm) : heightStr}
              disabled={lockToPhoto}
              title={lockToPhoto ? "Altura calculada pela proporção da foto" : undefined}
              onChange={(e) => setHeightStr(e.target.value)}
              onBlur={() => setHeightStr(String(heightMm))}
            />
          </Field>
          <Field label="Colunas" htmlFor="cols">
            <Input
              id="cols"
              inputMode="numeric"
              value={colsStr}
              onChange={(e) => setColsStr(e.target.value)}
              onBlur={() => setColsStr(String(cols))}
            />
          </Field>
          <Field label="Linhas" htmlFor="rows">
            <Input
              id="rows"
              inputMode="numeric"
              value={rowsStr}
              onChange={(e) => setRowsStr(e.target.value)}
              onBlur={() => setRowsStr(String(rows))}
            />
          </Field>
        </div>

        {tooSmall ? (
          <p
            className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400"
            title={`Peças menores que ${MIN_SAFE_PIECE_MM}mm ficam frágeis no corte a laser. Reduza colunas/linhas ou aumente a chapa.`}
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            {pieceCount} peças de {pieceW.toFixed(1)} × {pieceH.toFixed(1)} mm — frágeis demais
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {pieceCount} peças de {pieceW.toFixed(1)} × {pieceH.toFixed(1)} mm
          </p>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Orelha"
            display={`${Math.round(tabSize * 100)}%`}
            value={[tabSize]}
            min={0.15}
            max={0.4}
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
          <Label htmlFor="seed" className="text-xs">
            Seed
          </Label>
          <Input
            id="seed"
            inputMode="numeric"
            className="flex-1"
            value={seedStr}
            onChange={(e) => setSeedStr(e.target.value)}
            onBlur={() => setSeedStr(String(seed))}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={randomizeSeed}
            title="Sortear novo padrão"
          >
            <Dices />
          </Button>
        </div>

        <Separator />

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
            className="flex-1"
            onClick={() => photoInputRef.current?.click()}
            title="A foto aparece sob as linhas no preview, só no seu navegador — não vai no SVG de corte nem para a internet."
          >
            <ImagePlus />
            {photo ? "Trocar foto" : "Foto de referência"}
          </Button>
          {photo && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={removePhoto}
              title="Remover foto"
            >
              <X />
            </Button>
          )}
        </div>
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

        <Separator />

        <div
          className="flex items-center gap-2"
          title="Cor e espessura são só do preview — o SVG baixado sai sempre com linha fina preta de 0,1 mm, padrão para corte a laser."
        >
          {STROKE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.label}
              onClick={() => setStrokeColor(preset.value)}
              className={cn(
                "size-6 rounded-full border-2 ring-1 ring-border transition-transform hover:scale-110",
                strokeColor === preset.value ? "border-primary" : "border-transparent",
              )}
              style={{ backgroundColor: preset.value }}
            />
          ))}
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="size-6 cursor-pointer rounded-full border border-border bg-transparent p-0"
            title="Cor personalizada"
          />
          <div className="ml-auto flex items-center gap-1.5">
            <Label htmlFor="stroke-width" className="text-xs text-muted-foreground">
              mm
            </Label>
            <Input
              id="stroke-width"
              inputMode="decimal"
              value={strokeWidthStr}
              onChange={(e) => setStrokeWidthStr(e.target.value)}
              onBlur={() => setStrokeWidthStr(String(strokeWidthMm))}
              className="w-14"
            />
          </div>
        </div>

        <Button onClick={downloadSvg} className="mt-auto w-full">
          <Download />
          Baixar SVG
        </Button>
      </aside>

      <main
        className="flex min-h-[60svh] flex-1 flex-col items-center justify-center gap-3 p-4 md:p-8"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--color-muted) 25%, transparent 25%), linear-gradient(-45deg, var(--color-muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-muted) 75%), linear-gradient(-45deg, transparent 75%, var(--color-muted) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
            <Ruler className="size-3.5 text-muted-foreground" />
            {widthMm} × {heightMm} mm
          </span>
          <span className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
            <Scissors className="size-3.5 text-muted-foreground" />
            {pieceCount} peças
          </span>
        </div>
        <div
          className="relative overflow-hidden bg-white shadow-xl ring-1 ring-black/5"
          style={{
            width: `min(100%, calc(75svh * ${(widthMm / heightMm).toFixed(4)}))`,
          }}
        >
          {photo && (
            <img
              src={photo}
              alt="Imagem de referência do quebra-cabeça"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <div
            className="relative [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: puzzle.svg }}
          />
        </div>
      </main>
    </div>
  )
}
