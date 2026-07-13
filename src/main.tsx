import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Aplica o tema antes do primeiro render para não piscar claro->escuro.
const storedTheme = localStorage.getItem('theme')
if (
  storedTheme === 'dark' ||
  (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
) {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
