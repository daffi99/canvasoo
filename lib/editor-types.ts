export const CANVAS_SIZE = 2000

export interface Layer {
  id: string
  src: string
  name: string
  x: number
  y: number
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  visible: boolean
}

export function createId(): string {
  return Math.random().toString(36).slice(2, 10)
}
