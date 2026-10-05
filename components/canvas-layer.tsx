"use client"

import type React from "react"
import { useRef } from "react"
import { RotateCw } from "lucide-react"
import { CANVAS_SIZE, type Layer } from "@/lib/editor-types"
import { cn } from "@/lib/utils"

interface CanvasLayerProps {
  layer: Layer
  selected: boolean
  scale: number
  others: Layer[]
  allLayers?: Layer[]
  selectedIds?: string[]
  userGuidelines?: Array<{ id: string; type: "horizontal" | "vertical"; position: number }>
  onSelect: (id: string, e?: React.PointerEvent) => void
  onChange: (id: string, patch: Partial<Layer>) => void
  onBatchChange?: (updates: Array<{ id: string; patch: Partial<Layer> }>) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  onGuides: (guides: { x: number[]; y: number[] }) => void
}

type DragMode = "move" | "resize" | "rotate"

// Snap threshold in screen pixels (converted to canvas px using scale).
const SNAP_PX = 6

export function CanvasLayer({
  layer,
  selected,
  scale,
  others,
  allLayers = [],
  selectedIds = [],
  userGuidelines = [],
  onSelect,
  onChange,
  onBatchChange,
  onDragStart,
  onDragEnd,
  onGuides,
}: CanvasLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
    ratio: number
    origRotation: number
    centerX: number
    centerY: number
    startAngleDeg: number
    otherSelectedOrigs: Array<{ id: string; x: number; y: number }>
    targetsX: number[]
    targetsY: number[]
    moved: boolean
  } | null>(null)

  if (!layer.visible) return null

  function buildTargets() {
    const xs = [0, CANVAS_SIZE / 2, CANVAS_SIZE]
    const ys = [0, CANVAS_SIZE / 2, CANVAS_SIZE]
    for (const g of userGuidelines) {
      if (g.type === "vertical") xs.push(g.position)
      else if (g.type === "horizontal") ys.push(g.position)
    }
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
    onSelect(layer.id, e)
    const { xs, ys } = buildTargets()

    const otherSelected =
      mode === "move" && selectedIds && selectedIds.length > 1 && selectedIds.includes(layer.id) && allLayers
        ? allLayers.filter((l) => selectedIds.includes(l.id) && l.id !== layer.id)
        : []

    let centerX = 0
    let centerY = 0
    let startAngleDeg = 0

    if (mode === "rotate") {
      const layerEl = layerRef.current
      if (layerEl) {
        const rect = layerEl.getBoundingClientRect()
        centerX = rect.left + rect.width / 2
        centerY = rect.top + rect.height / 2
      } else {
        centerX = e.clientX
        centerY = e.clientY
      }
      const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX)
      startAngleDeg = (rad * 180) / Math.PI
    }

    stateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
      origW: layer.width,
      origH: layer.height,
      ratio: layer.width / layer.height,
      origRotation: layer.rotation || 0,
      centerX,
      centerY,
      startAngleDeg,
      otherSelectedOrigs: otherSelected.map((l) => ({ id: l.id, x: l.x, y: l.y })),
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

    if (s.mode === "rotate") {
      const currentRad = Math.atan2(e.clientY - s.centerY, e.clientX - s.centerX)
      const currentDeg = (currentRad * 180) / Math.PI
      const diff = currentDeg - s.startAngleDeg
      let newDeg = Math.round(s.origRotation + diff)

      newDeg = ((newDeg % 360) + 360) % 360

      if (e.shiftKey) {
        newDeg = (Math.round(newDeg / 15) * 15) % 360
      } else {
        for (const snapAngle of [0, 90, 180, 270, 360]) {
          if (Math.abs(newDeg - snapAngle) <= 4) {
            newDeg = snapAngle % 360
            break
          }
        }
      }

      onChange(layer.id, { rotation: newDeg })
      return
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

      const deltaX = nx - s.origX
      const deltaY = ny - s.origY

      if (s.otherSelectedOrigs && s.otherSelectedOrigs.length > 0 && onBatchChange) {
        const updates = [
          { id: layer.id, patch: { x: nx, y: ny } },
          ...s.otherSelectedOrigs.map((o) => ({
            id: o.id,
            patch: { x: Math.round(o.x + deltaX), y: Math.round(o.y + deltaY) },
          })),
        ]
        onBatchChange(updates)
      } else {
        onChange(layer.id, { x: nx, y: ny })
      }
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
      ref={layerRef}
      className={cn(
        "absolute touch-none select-none",
        selected ? "outline outline-2 outline-selection" : "outline-none",
      )}
      style={{
        left: layer.x,
        top: layer.y,
        width: layer.width,
        height: layer.height,
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      onPointerDown={(e) => handlePointerDown(e, "move")}
    >
      {layer.type === "text" ? (
        <div
          className="pointer-events-none flex h-full w-full items-start justify-start overflow-hidden select-none whitespace-pre-wrap text-left leading-tight break-words p-2"
          style={{
            fontSize: `${layer.fontSize ?? 48}px`,
            color: layer.color ?? "#000000",
            fontFamily: "sans-serif",
            fontWeight: "bold",
            opacity: layer.opacity ?? 1,
          }}
        >
          {layer.text || "Text"}
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={layer.src || "/placeholder.svg"}
          alt={layer.name}
          draggable={false}
          className="pointer-events-none h-full w-full object-fill"
          style={{ opacity: layer.opacity ?? 1 }}
        />
      )}
      {selected && (
        <>
          <div
            role="presentation"
            onPointerDown={(e) => handlePointerDown(e, "rotate")}
            className="absolute -top-7 left-1/2 flex -translate-x-1/2 flex-col items-center cursor-grab active:cursor-grabbing z-30"
            style={{ transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: "bottom center" }}
            title="Click & drag to rotate layer (Hold Shift for 15° steps)"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-selection bg-background shadow-xs hover:scale-110 transition-transform">
              <RotateCw className="h-3 w-3 text-selection" />
            </div>
            <div className="h-2.5 w-0.5 bg-selection" />
          </div>

          <span
            role="presentation"
            onPointerDown={(e) => handlePointerDown(e, "resize")}
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-selection bg-background"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: "bottom right" }}
          />
        </>
      )}
    </div>
  )
}
