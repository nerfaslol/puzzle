/**
 * Wrappers de localStorage que nunca lançam.
 *
 * Acessar `localStorage` pode lançar em situações reais — navegação privada com storage
 * bloqueado, cookies de terceiros desabilitados num iframe, cota estourada no `setItem`. Como
 * persistência aqui é conveniência (não requisito), qualquer falha degrada para "sessão sem
 * persistência" em vez de derrubar a aplicação.
 */

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* segue sem persistir */
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* segue sem persistir */
  }
}
