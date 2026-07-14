import { safeGet, safeRemove, safeSet } from "@/lib/storage"

export type Theme = "system" | "light" | "dark"

/** Chave mantida como "theme" (sem prefixo) para não perder a preferência de quem já usou o app. */
const THEME_KEY = "theme"

/**
 * "system" é o padrão e é representado pela AUSÊNCIA da chave — assim um usuário novo (e um que
 * escolheu "system" explicitamente) caem no mesmo estado, e a preferência do SO continua sendo
 * seguida se ele trocar de tema depois.
 */
export function readTheme(): Theme {
  const raw = safeGet(THEME_KEY)
  return raw === "light" || raw === "dark" ? raw : "system"
}

export function saveTheme(theme: Theme): void {
  if (theme === "system") safeRemove(THEME_KEY)
  else safeSet(THEME_KEY, theme)
}

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function isDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && prefersDark())
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", isDark(theme))
}
