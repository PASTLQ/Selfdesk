# SelfDesk を拡張する

見た目と機能は、4つの層に分かれています。変えたいものに応じて、触る場所を選びます。

| 変えたいもの | 触る場所 | コード変更 |
|---|---|---|
| 色・角丸・密度・文字サイズ | 設定 > 外観(または `src/theme/tokens.css`) | 不要 |
| 見た目の一括切替(スキン) | `registerSkin()` | CSSのみ |
| 画面・「今日」の部品・⌘Kコマンドの追加 | `src/extensions/*.tsx` に1ファイル追加 | 1ファイル |
| データの形(項目の追加) | `src/types.ts` → `src/core/merge.ts` → `mcp/src/server.ts` | 要(下記) |

## 1. デザイントークン(`src/theme/tokens.css`)
すべての部品は変数だけで色・余白・角丸を決めています。リテラルの色は書かないでください。
- 面: `--bg` `--surface` `--surface-2` `--sidebar` `--border` `--edge`
- 文字: `--fg` `--muted`、サイズ `--t-xs … --t-hero`(rem。設定の文字サイズで伸縮)
- アクセント: `--accent-base`(設定で変わる)→ `--accent` `--accent-fg` `--accent-soft` `--accent-line`
- 形: `--r-sm` `--r` `--r-lg`、余白 `--s1 … --s6`
- 密度: `--ctl-h`(ボタン高さ)`--row-h`(行高さ)。タッチ端末は自動で 44px 以上
- トークンは `@layer` の中にあり、**設定 > カスタムCSS は常にそれより優先**されます(詳細度を気にしなくてよい)。
- コントラスト基準: `--fg`/`--muted` は背景に対し 4.5:1 以上、`--edge` は 3:1 以上を保ってください。

## 2. スキンを足す
```ts
registerSkin({ id: 'mono', label: 'Mono', css: `
  :root[data-skin="mono"] { --r: 0; --r-lg: 0; --accent-base: #000 }
  :root[data-skin="mono"][data-theme="dark"] { --bg: #000 }
` })
```
設定 > 外観 > スキン に自動で出ます。

## 3. 拡張(`src/extensions/`)
`src/extensions/` に `.ts` / `.tsx` を置くだけで起動時に読み込まれます(`_` で始まるファイルは無視)。ひな形は `_example.tsx`。

```ts
registerView({ id, title, icon, group, order, width, mobile, component, aside })  // 画面
registerWidget({ id, title, span: 'full' | 'half', heading, order, component })   // 「今日」の部品
registerCommand({ id, title, section, keywords, run })                             // ⌘K の項目
registerSource(id, query => Command[])                                            // ⌘K の動的な検索結果
registerSkin({ id, label, css })                                                  // スキン
```
- 画面は URL `#/<id>`、サイドバー、⌘K に自動で載ります。`mobile: true` でスマホの下タブにも出ます。
- 部品は設定で並び替え・非表示にできます。
- 便利な部品: `useStore(selector)` / `addTask` など(`src/store.ts`)、`openTask(id)`(`src/ui-state.ts`)、`go('notes/<id>')`(`src/route.ts`)、`useToday()`(`src/widgets/today.tsx`)、`Sheet` `Seg` `Check`(`src/ui.tsx`)。
- 共通クラス: `.btn .btn-primary .chip .seg .field .rows .trow .well .plate .notice .badge .sheet` など(`src/theme/base.css`)。

## 4. データの項目を増やす(同期・MCPに関わる)
1. `src/types.ts` に項目を足す(省略可能 `?` にすると古いデータと互換)
2. 画面側で読み書きする(`patchTask` など。`u`(更新時刻)は自動で付きます)
3. AI から扱わせたいときは `mcp/src/server.ts` にツールを足す(`npm run build:mcp`)

設定(`settings`)は端末ごとのローカル保存で、同期されません。端末をまたいで共有したい値は `Data` 側に置いてください。
