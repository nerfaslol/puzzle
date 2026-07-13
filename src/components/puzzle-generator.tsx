import { useMemo, useState } from "react"
import { AlertTriangle, Dices, Download, Ruler, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { generatePuzzle } from "@/lib/jigsaw"

const STROKE_PRESETS = [
  { label: "Preto", value: "#111111" },
  { label: "Vermelho", value: "#e11d2e" },
  { label: "Azul", value: "#1d4ed8" },
]

const MIN_SAFE_PIECE_MM = 15

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>
}

export function PuzzleGenerator() {
  const [widthMm, setWidthMm] = useState(300)
  const [heightMm, setHeightMm] = useState(200)
  const [cols, setCols] = useState(6)
  const [rows, setRows] = useState(4)
  const [seed, setSeed] = useState(1234)
  const [tabSize, setTabSize] = useState(0.28)
  const [jitter, setJitter] = useState(0.6)
  const [strokeColor, setStrokeColor] = useState(STROKE_PRESETS[0].value)
  const [strokeWidthMm, setStrokeWidthMm] = useState(0.3)

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

  function randomizeSeed() {
    setSeed(Math.floor(Math.random() * 1_000_000))
  }

  function downloadSvg() {
    const blob = new Blob([puzzle.svg], { type: "image/svg+xml" })
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
    <div className="grid w-full max-w-6xl gap-6 p-4 md:p-8 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit gap-5">
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription>
            Padrão de corte em SVG, em escala real (mm), pronto para a máquina a laser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <SectionTitle>Chapa</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Largura (mm)" htmlFor="width">
                <Input
                  id="width"
                  type="number"
                  min={10}
                  value={widthMm}
                  onChange={(e) => setWidthMm(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Altura (mm)" htmlFor="height">
                <Input
                  id="height"
                  type="number"
                  min={10}
                  value={heightMm}
                  onChange={(e) => setHeightMm(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <SectionTitle>Peças</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Colunas" htmlFor="cols">
                <Input
                  id="cols"
                  type="number"
                  min={2}
                  value={cols}
                  onChange={(e) => setCols(Math.max(2, Number(e.target.value) || 2))}
                />
              </Field>
              <Field label="Linhas" htmlFor="rows">
                <Input
                  id="rows"
                  type="number"
                  min={2}
                  value={rows}
                  onChange={(e) => setRows(Math.max(2, Number(e.target.value) || 2))}
                />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              {pieceCount} peças · {pieceW.toFixed(1)} × {pieceH.toFixed(1)} mm cada
            </p>
            {tooSmall && (
              <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-500">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Peças menores que {MIN_SAFE_PIECE_MM}mm podem ficar frágeis ou perder detalhe no
                corte a laser. Reduza colunas/linhas ou aumente a chapa.
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <SectionTitle>Formato do encaixe</SectionTitle>
            <div className="flex flex-col gap-2">
              <Label>Tamanho da orelha ({Math.round(tabSize * 100)}%)</Label>
              <Slider
                value={[tabSize]}
                min={0.15}
                max={0.4}
                step={0.01}
                onValueChange={(v) => setTabSize(Array.isArray(v) ? v[0] : v)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Aleatoriedade ({Math.round(jitter * 100)}%)</Label>
              <Slider
                value={[jitter]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => setJitter(Array.isArray(v) ? v[0] : v)}
              />
            </div>
            <Field label="Seed" htmlFor="seed">
              <div className="flex gap-2">
                <Input
                  id="seed"
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
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
            </Field>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <SectionTitle>Traçado (visual)</SectionTitle>
            <div className="flex items-center gap-2">
              {STROKE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => setStrokeColor(preset.value)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform hover:scale-110",
                    strokeColor === preset.value ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="size-7 cursor-pointer rounded-full border border-border bg-transparent p-0"
                title="Cor personalizada"
              />
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="stroke-width" className="text-muted-foreground text-xs">
                  Espessura
                </Label>
                <Input
                  id="stroke-width"
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={strokeWidthMm}
                  onChange={(e) => setStrokeWidthMm(Number(e.target.value) || 0.1)}
                  className="w-16"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A cor/espessura é só para visualização — a máquina a laser trata qualquer traçado
              vetorial fechado como linha de corte.
            </p>
          </div>

          <Button onClick={downloadSvg} className="mt-1" size="lg">
            <Download />
            Baixar SVG
          </Button>
        </CardContent>
      </Card>

      <Card className="h-fit gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Ruler className="size-4 text-muted-foreground" />
            {widthMm} × {heightMm} mm
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Scissors className="size-4" />
            {pieceCount} peças
          </div>
        </div>
        <div
          className="flex items-center justify-center p-6 md:p-10"
          style={{
            backgroundImage:
              "linear-gradient(45deg, var(--color-muted) 25%, transparent 25%), linear-gradient(-45deg, var(--color-muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-muted) 75%), linear-gradient(-45deg, transparent 75%, var(--color-muted) 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        >
          <div
            className="w-full max-w-full bg-white shadow-lg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: puzzle.svg }}
          />
        </div>
      </Card>
    </div>
  )
}
