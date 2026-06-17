"use client"

import type React from "react"
import { useRef } from "react"
import { CANVAS_SIZE, type Layer } from "@/lib/editor-types"
import { cn } from "@/lib/utils"

interface CanvasLayerProps {
  layer: Layer
  selected: boolean
  scale: number
  others: Layer[]
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<Layer>) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  onGuides: (guides: { x: number[]; y: number[] }) => void
}

type DragMode = "move" | "resize"

// Snap threshold in screen pixels (converted to canvas px using scale).
const SNAP_PX = 6

export function CanvasLayer({
  layer,
  selected,
  scale,
  others,
  onSelect,
  onChange,
  onDragStart,
  onDragEnd,
  onGuides,
}: CanvasLayerProps) {
  const stateRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
    ratio: number
    targetsX: number[]
    targetsY: number[]
    moved: boolean
  } | null>(null)

  if (!layer.visible) return null

  function buildTargets() {
    const xs = [0, CANVAS_SIZE / 2, CANVAS_SIZE]
    const ys = [0, CANVAS_SIZE / 2, CANVAS_SIZE]
    for (const o of others) {
      if (!o.visible) continue
      xs.push(o.x, o.x + o.width / 2, o.x + o.width)
      ys.push(o.y, o.y + o.height / 2, o.y + o.height)
    }
    return { xs, ys }
  }

  // Find the best snap for a set of moving edges against target lines.
  // Returns the offset to apply and the matched guide line, or null.
  function bestSnap(edges: number[], targets: number[], threshold: number) {
    let best: { offset: number; guide: number; dist: number } | null = null
    for (const edge of edges) {
      for (const t of targets) {
        const dist = Math.abs(edge - t)
        if (dist <= threshold && (!best || dist < best.dist)) {
          best = { offset: t - edge, guide: t, dist }
        }
      }
    }
    return best
  }

  function handlePointerDown(e: React.PointerEvent, mode: DragMode) {
    e.stopPropagation()
    onSelect(layer.id)
    const { xs, ys } = buildTargets()
    stateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
      origW: layer.width,
      origH: layer.height,
      ratio: layer.width / layer.height,
      targetsX: xs,
      targetsY: ys,
      moved: false,
    }
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }

  function handlePointerMove(e: PointerEvent) {
    const s = stateRef.current
    if (!s) return
    const dx = (e.clientX - s.startX) / scale
    const dy = (e.clientY - s.startY) / scale
    const threshold = SNAP_PX / scale
    const activeX: number[] = []
    const activeY: number[] = []

    if (!s.moved && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
      s.moved = true
      onDragStart?.()
    }

    if (s.mode === "move") {
      let nx = Math.round(s.origX + dx)
      let ny = Math.round(s.origY + dy)

      const snapX = bestSnap([nx, nx + s.origW / 2, nx + s.origW], s.targetsX, threshold)
      if (snapX) {
        nx = Math.round(nx + snapX.offset)
        activeX.push(snapX.guide)
      }
      const snapY = bestSnap([ny, ny + s.origH / 2, ny + s.origH], s.targetsY, threshold)
      if (snapY) {
        ny = Math.round(ny + snapY.offset)
        activeY.push(snapY.guide)
      }

      onChange(layer.id, { x: nx, y: ny })
    } else {
      // Resize from bottom-right, aspect ratio locked.
      let nextW = Math.max(24, Math.round(s.origW + dx))
      let nextH = Math.max(24, Math.round(nextW / s.ratio))

      // Snap the right edge to vertical guides and the bottom edge to
      // horizontal guides; choose whichever produces the closer match.
      const rightSnap = bestSnap([s.origX + nextW], s.targetsX, threshold)
      const bottomSnap = bestSnap([s.origY + nextH], s.targetsY, threshold)

      const wFromRight = rightSnap ? rightSnap.guide - s.origX : null
      const wFromBottom = bottomSnap ? (bottomSnap.guide - s.origY) * s.ratio : null

      let chosenW: number | null = null
      if (wFromRight != null && wFromBottom != null) {
        chosenW = Math.abs(wFromRight - nextW) <= Math.abs(wFromBottom - nextW) ? wFromRight : wFromBottom
      } else {
        chosenW = wFromRight ?? wFromBottom
      }

      if (chosenW != null && chosenW >= 24) {
        nextW = Math.round(chosenW)
        nextH = Math.max(24, Math.round(nextW / s.ratio))
        if (chosenW === wFromRight && rightSnap) activeX.push(rightSnap.guide)
        if (chosenW === wFromBottom && bottomSnap) activeY.push(bottomSnap.guide)
      }

      onChange(layer.id, { width: nextW, height: nextH })
    }

    onGuides({ x: activeX, y: activeY })
  }

  function handlePointerUp() {
    const s = stateRef.current
    const wasMoved = s?.moved
    stateRef.current = null
    onGuides({ x: [], y: [] })
    window.removeEventListener("pointermove", handlePointerMove)
    window.removeEventListener("pointerup", handlePointerUp)
    if (wasMoved) {
      onDragEnd?.()
    }
  }

  return (
    <div
      className={cn(
        "absolute touch-none select-none",
        selected ? "outline outline-2 outline-selection" : "outline-none",
      )}
      style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height }}
      onPointerDown={(e) => handlePointerDown(e, "move")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layer.src || "/placeholder.svg"}
        alt={layer.name}
        draggable={false}
        className="pointer-events-none h-full w-full object-fill"
      />
      {selected && (
        <span
          role="presentation"
          onPointerDown={(e) => handlePointerDown(e, "resize")}
          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-selection bg-background"
          style={{ transform: `scale(${1 / scale})`, transformOrigin: "bottom right" }}
        />
      )}
    </div>
  )
}
