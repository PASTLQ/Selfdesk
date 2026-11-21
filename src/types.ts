export type Repeat = 'daily' | 'weekly' | 'monthly' | null
export interface Sub { id: string; title: string; done: boolean }
export interface Block { date: string; start: number; dur: number; gid?: string }
export interface Task {
  id: string; title: string; notes: string; done: boolean; doneAt?: string
  priority: 0 | 1 | 2 | 3; due?: string; project: string; tags: string[]
  est?: number; repeat: Repeat; subs: Sub[]; block?: Block; createdAt: string; u?: number
}
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
  theme: 'auto' | 'light' | 'dark'; dayStart: number; dayEnd: number
  gClientId: string; gSync: boolean
  ghToken: string; ghRepo: string; ghPath: string; ghBranch: string
}
/** デバイス間で同期されるデータ(data.json の中身) */
export interface Data {
  version: 1
  tasks: Task[]; events: Ev[]; habits: Habit[]; notes: Note[]
  reviews: Record<string, Review>; projects: string[]
  deleted: Record<string, number>
}
export interface State extends Data { gEvents: Ev[]; settings: Settings }
