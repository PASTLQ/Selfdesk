import { createRoot } from 'react-dom/client'
import './ds.css'
import './app.css'
import App from './App'
import { startSync } from './lib/sync'

createRoot(document.getElementById('root')!).render(<App />)
startSync()
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {})
