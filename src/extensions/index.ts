/**
 * 自分専用の拡張の読み込み口。
 * このフォルダに .ts / .tsx ファイルを置くと、起動時に自動で読み込まれる(ファイル名が _ で始まるものは除く)。
 * 書き方は src/extensions/_example.tsx と docs/EXTENDING.md を参照。
 */
import.meta.glob('./[!_]*.{ts,tsx}', { eager: true })
export {}
