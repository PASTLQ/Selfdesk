const P: Record<string, string> = {
  today: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  notes: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  habits: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  review: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  heart: 'M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.2 5 6.600 5c2 0 3.700 1.100 5.400 3 1.700-1.900 3.400-3 5.400-3 3.400 0 5.400 3.600 4.100 6.800C19.500 16.400 12 21 12 21z',
  tree: 'M3 10h5v4H3zM16 4h5v4h-5zM16 16h5v4h-5zM8 12h3V6h5M11 12v6h5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
}
/** name は組み込みアイコン名。独自の SVG path を直接渡すこともできる(24x24, stroke 描画)。 */
export function Icon({ name }: { name: string }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={P[name] ?? name} /></svg>
}
export const iconNames = Object.keys(P)
