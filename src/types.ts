/** 他の項目への参照(ツール間の連携に使う)。kind は task / event / habit / note / wish / コレクションID */
export interface Ref { kind: string; id: string }
export type Repeat = 'daily' | 'weekly' | 'monthly' | null
export interface Sub { id: string; title: string; done: boolean }
export interface Block { date: string; start: number; dur: number; gid?: string }
export interface Task {
  id: string; title: string; notes: string; done: boolean; doneAt?: string
  priority: 0 | 1 | 2 | 3; due?: string; tags: string[]
  est?: number; repeat: Repeat; subs: Sub[]; block?: Block; createdAt: string; u?: number
  /** @deprecated 旧: プロジェクト名の文字列。読み込み時に parent へ移行される */
  project?: string
  /** 階層: 親(プロジェクトまたはタスク)。プロジェクト・タスク・Todoの境界は主観なので、同じ1本のツリーで表す */
  parent?: string; order?: number; start?: string; milestone?: boolean
  /** true の項目が「プロジェクト」(目標と完了条件を持つ)。いつでも昇格・降格できる */
  isProject?: boolean; goal?: string; doneWhen?: string; approach?: string
  archived?: boolean; links?: Ref[]
}
/** やりたいこと(願望ベース。義務ではない)。「やる」と決めたらプロジェクトに昇格できる */
export interface Wish {
  id: string; title: string; note: string; status: 'someday' | 'planned' | 'done'
  category?: string; target?: string; tags: string[]; project?: string
  doneAt?: string; reflection?: string; createdAt: string; links?: Ref[]; u?: number
}
/** ツール拡張のデータ1件。形は src/collections/ のスキーマで定義する */
export interface ExtItem { id: string; u?: number; [k: string]: unknown }
export interface Ev { id: string; title: string; date: string; start: number; dur: number; allDay?: boolean; gid?: string; source: 'local' | 'google'; place?: string; u?: number }
export interface Habit { id: string; name: string; days: number[]; log: Record<string, true>; archived?: boolean; createdAt: string; u?: number }
export interface TreeNode { id: string; text: string; parent: string | null; collapsed?: boolean; order: number }
export interface BNode { id: string; kind: 'sticky' | 'text' | 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; text: string; color: number }
export interface BEdge { id: string; from: string; to: string }
export interface Stroke { id: string; pts: [number, number][] }
export interface Note {
  id: string; title: string; kind: 'doc' | 'tree' | 'board'; body: string
  tree: TreeNode[]; nodes: BNode[]; edges: BEdge[]; strokes: Stroke[]
  tags: string[]; pinned?: boolean; createdAt: string; updatedAt: string; u?: number
}
export interface Review { wins: string; lessons: string; next: string; mood: number; u?: number }
export interface Settings {
  theme: 'auto' | 'light' | 'dark'; skin: string; accent: string; density: 'compact' | 'normal' | 'roomy'; fontScale: number
  customCss: string; todayOrder: string[]; todayHidden: string[]; dayStart: number; dayEnd: number
  gClientId: string; gSync: boolean
  ghToken: string; ghRepo: string; ghPath: string; ghBranch: string
}
/** デバイス間で同期されるデータ(data.json の中身) */
export interface Data {
  version: 1
  tasks: Task[]; events: Ev[]; habits: Habit[]; notes: Note[]; wishes: Wish[]
  ext: Record<string, ExtItem[]>
  reviews: Record<string, Review>
  /** @deprecated 旧プロジェクト名一覧。常に空(プロジェクトは Task.isProject) */
  projects: string[]
  deleted: Record<string, number>
}
export interface State extends Data { gEvents: Ev[]; settings: Settings }
