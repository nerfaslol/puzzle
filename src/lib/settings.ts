import { safeGet, safeRemove, safeSet } from "@/lib/storage"

/**
 * Parâmetros do gerador que sobrevivem ao reload.
 *
 * Os campos numéricos digitáveis ficam como string porque o input guarda texto livre — o clamp só
 * acontece na geração e no blur (ver `parseClamped`), senão digitar "12" trava no "1".
 *
 * A foto de referência NÃO entra aqui de propósito: um data URL de imagem passa fácil dos ~5 MB de
 * cota do localStorage e derrubaria a persistência de todo o resto junto.
 */
export interface PuzzleSettings {
  width: string
  height: string
  cols: string
  rows: string
  seed: string
  strokeWidth: string
  tabSize: number
  jitter: number
  strokeColor: string
}

export const DEFAULT_SETTINGS: PuzzleSettings = {
  width: "300",
  height: "200",
  cols: "12",
  rows: "8",
  seed: "1234",
  strokeWidth: "1",
  tabSize: 0.25,
  jitter: 0,
  strokeColor: "#111111",
}

const SETTINGS_KEY = "puzzle:settings"

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/**
 * Lê os settings campo a campo, checando o tipo de cada um contra o default. JSON no localStorage é
 * entrada não confiável: pode estar corrompido, editado à mão, ou ser de uma versão anterior do app
 * com outro formato. Qualquer campo inválido cai no default em vez de contaminar o estado.
 */
export function loadSettings(): PuzzleSettings {
  const raw = safeGet(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }

  let stored: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_SETTINGS }
    stored = parsed as Record<string, unknown>
  } catch {
    return { ...DEFAULT_SETTINGS }
  }

  const d = DEFAULT_SETTINGS
  return {
    width: str(stored.width, d.width),
    height: str(stored.height, d.height),
    cols: str(stored.cols, d.cols),
    rows: str(stored.rows, d.rows),
    seed: str(stored.seed, d.seed),
    strokeWidth: str(stored.strokeWidth, d.strokeWidth),
    tabSize: num(stored.tabSize, d.tabSize),
    jitter: num(stored.jitter, d.jitter),
    strokeColor: str(stored.strokeColor, d.strokeColor),
  }
}

export function saveSettings(settings: PuzzleSettings): void {
  safeSet(SETTINGS_KEY, JSON.stringify(settings))
}

export function clearSettings(): void {
  safeRemove(SETTINGS_KEY)
}
