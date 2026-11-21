import type { Settings } from '../types'
import { skinCss } from '../registry'

export const ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: 'indigo', label: 'インディゴ', hex: '#5b5bd6' }, { id: 'blue', label: 'ブルー', hex: '#2563eb' },
  { id: 'teal', label: 'ティール', hex: '#0f766e' }, { id: 'rose', label: 'ローズ', hex: '#d6204f' },
  { id: 'amber', label: 'アンバー', hex: '#b45309' }, { id: 'zinc', label: 'モノクロ', hex: '#3f3f46' },
]
const lum = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }
export const accentHex = (a: string) => ACCENTS.find(x => x.id === a)?.hex ?? (/^#[0-9a-f]{6}$/i.test(a) ? a : ACCENTS[0].hex)

function sheet(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el) }
  if (el.textContent !== css) el.textContent = css
}

/** 設定 → <html> の属性・CSS 変数・ユーザーCSS に反映する(再実行しても安全) */
export function applyTheme(s: Settings) {
  const r = document.documentElement
  s.theme === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', s.theme)
  r.dataset.skin = s.skin; r.dataset.density = s.density
  r.style.setProperty('--fs', String(s.fontScale || 1))
  const hex = accentHex(s.accent)
  r.style.setProperty('--accent-base', hex)
  r.style.setProperty('--accent-fg-l', lum(hex) > .4 ? '#18181b' : '#ffffff')
  sheet('sd-skin-css', '@layer skin {\n' + skinCss() + '\n}')
  sheet('sd-user-css', s.customCss || '')   // 最後に置くので、常に最優先
}
