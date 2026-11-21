/**
 * コレクション(ツール拡張のデータ定義)の一覧 ― アプリと MCP の両方がここを読む。
 * 新しいツールのデータを足すときは、このフォルダに定義ファイルを作り、ここに1行追加する。
 * (npm run check が「定義ファイルがあるのに ここに無い」ミスを検出する)
 */
import type { CollectionDef } from '../core/collections'

export const COLLECTIONS: CollectionDef[] = [
  // 例: import { books } from './books'  →  books,
]
