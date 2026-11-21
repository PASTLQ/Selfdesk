import type { Data } from '../../src/types'
/** データの読み書き口。stdio版(ファイル/GitHub)とリモート版(GitHub)で差し替える。 */
export interface IO {
  /** 最新データを読み、fn で変更し、変更があれば書き戻す(競合時は読み直して再実行) */
  mutate<T>(fn: (d: Data) => T, message?: string): Promise<T>
  read<T>(fn: (d: Data) => T): Promise<T>
}
