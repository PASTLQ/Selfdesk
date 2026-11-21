import { defineCollection } from '../core/collections'

/** 定義のひな形。使うときは「_」を外したファイル名にコピーし、index.ts に1行追加する。 */
export const books = defineCollection({
  id: 'books', label: '読書ログ', description: '読んだ本・読みたい本の記録。感想と学びを残す。', version: 1,
  titleField: 'title',
  fields: [
    { key: 'title', label: '書名', type: 'text', required: true },
    { key: 'author', label: '著者', type: 'text' },
    { key: 'status', label: '状態', type: 'select', options: ['読みたい', '読書中', '読了'], required: true },
    { key: 'finished', label: '読了日', type: 'date' },
    { key: 'rating', label: '評価(1-5)', type: 'number' },
    { key: 'notes', label: '感想・学び', type: 'longtext' },
    { key: 'related', label: '関連するプロジェクト', type: 'ref', help: 'kind と id を持つ参照' },
  ],
})
