"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { CANVAS_SIZE } from "@/lib/editor-types"

interface CanvasRulerProps {
  scale: number
  onCreateGuideline: (type: "horizontal" | "vertical", initialPosition: number) => void
}

const RULER_THICKNESS = 20

export function CanvasRuler({ scale, onCreateGuideline }: CanvasRulerProps) {
  const topRulerRef = useRef<HTMLCanvasElement>(null)
  const leftRulerRef = useRef<HTMLCanvasElement>(null)

  // Draw Top Ruler
  useEffect(() => {
    const canvas = topRulerRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = Math.round(CANVAS_SIZE * scale)
    const height = RULER_THICKNESS
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear background
    ctx.fillStyle = "oklch(0.97 0 0)"
    ctx.fillRect(0, 0, width, height)

    // Bottom border line
    ctx.strokeStyle = "oklch(0.88 0 0)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height - 0.5)
    ctx.lineTo(width, height - 0.5)
    ctx.stroke()

    ctx.fillStyle = "oklch(0.45 0 0)"
    ctx.strokeStyle = "oklch(0.6 0 0)"
    ctx.font = "9px sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"

    // Determine tick interval dynamically based on scale
    let majorStep = 100
    if (scale < 0.25) majorStep = 500
    else if (scale < 0.5) majorStep = 200

    const minorStep = majorStep / 5

    for (let pos = 0; pos <= CANVAS_SIZE; pos += minorStep) {
      const x = pos * scale
      if (x > width) break

      const isMajor = pos % majorStep === 0
      const isMedium = pos % (majorStep / 2) === 0
      const tickHeight = isMajor ? 12 : isMedium ? 8 : 4

      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, height)
      ctx.lineTo(Math.round(x) + 0.5, height - tickHeight)
      ctx.stroke()

      if (isMajor && x + 25 <= width) {
        ctx.fillText(pos.toString(), x + 3, 3)
      }
    }
  }, [scale])

  // Draw Left Ruler
  useEffect(() => {
    const canvas = leftRulerRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = RULER_THICKNESS
    const height = Math.round(CANVAS_SIZE * scale)
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear background
    ctx.fillStyle = "oklch(0.97 0 0)"
    ctx.fillRect(0, 0, width, height)

    // Right border line
    ctx.strokeStyle = "oklch(0.88 0 0)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(width - 0.5, 0)
    ctx.lineTo(width - 0.5, height)
    ctx.stroke()

    ctx.fillStyle = "oklch(0.45 0 0)"
    ctx.strokeStyle = "oklch(0.6 0 0)"
    ctx.font = "9px sans-serif"

    let majorStep = 100
    if (scale < 0.25) majorStep = 500
    else if (scale < 0.5) majorStep = 200

    const minorStep = majorStep / 5

    for (let pos = 0; pos <= CANVAS_SIZE; pos += minorStep) {
      const y = pos * scale
      if (y > height) break

      const isMajor = pos % majorStep === 0
      const isMedium = pos % (majorStep / 2) === 0
      const tickWidth = isMajor ? 12 : isMedium ? 8 : 4

      ctx.beginPath()
      ctx.moveTo(width, Math.round(y) + 0.5)
      ctx.lineTo(width - tickWidth, Math.round(y) + 0.5)
      ctx.stroke()

      if (isMajor && y + 15 <= height) {
        ctx.save()
        ctx.translate(3, y + 12)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(pos.toString(), 0, 0)
        ctx.restore()
      }
    }
  }, [scale])

  function handleTopRulerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const canvasEl = topRulerRef.current
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const startY = Math.max(0, Math.min(CANVAS_SIZE, Math.round((e.clientY - rect.bottom) / scale)))
    onCreateGuideline("horizontal", startY > 0 ? startY : 50)
  }

  function handleLeftRulerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const canvasEl = leftRulerRef.current
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const startX = Math.max(0, Math.min(CANVAS_SIZE, Math.round((e.clientX - rect.right) / scale)))
    onCreateGuideline("vertical", startX > 0 ? startX : 50)
  }

  return (
    <>
      {/* Top Left Corner */}
      <div
        className="absolute top-0 left-0 z-30 flex items-center justify-center bg-[#f3f4f6] text-[9px] font-mono text-muted-foreground border-r border-b border-border select-none"
        style={{ width: RULER_THICKNESS, height: RULER_THICKNESS }}
        title="Canvas Origin (0,0)"
      >
        px
      </div>

      {/* Top Ruler */}
      <div
        className="absolute top-0 z-20 cursor-ns-resize select-none overflow-hidden"
        style={{
          left: RULER_THICKNESS,
          width: CANVAS_SIZE * scale,
          height: RULER_THICKNESS,
        }}
        onMouseDown={handleTopRulerMouseDown}
        title="Click or drag down to add horizontal guideline"
      >
        <canvas
          ref={topRulerRef}
          style={{ width: CANVAS_SIZE * scale, height: RULER_THICKNESS }}
        />
      </div>

      {/* Left Ruler */}
      <div
        className="absolute left-0 z-20 cursor-ew-resize select-none overflow-hidden"
        style={{
          top: RULER_THICKNESS,
          width: RULER_THICKNESS,
          height: CANVAS_SIZE * scale,
        }}
        onMouseDown={handleLeftRulerMouseDown}
        title="Click or drag right to add vertical guideline"
      >
        <canvas
          ref={leftRulerRef}
          style={{ width: RULER_THICKNESS, height: CANVAS_SIZE * scale }}
        />
      </div>
    </>
  )
}
