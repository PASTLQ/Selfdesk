import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/base.css'
import './theme/shell.css'
import './app.css'
import App from './App'
import { startSync } from './lib/sync'
import { applyTheme } from './theme/apply'
import { get } from './store'

applyTheme(get().settings)   // 初回描画前に反映してちらつきを防ぐ
createRoot(document.getElementById('root')!).render(<App />)
startSync()
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {})
