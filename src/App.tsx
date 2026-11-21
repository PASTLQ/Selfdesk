import './views'              // 組み込み画面・ウィジェット・コマンドの登録
import './extensions'         // 自分専用の拡張(src/extensions/*.tsx)
import { Shell } from './shell/Shell'

export default function App() { return <Shell /> }
