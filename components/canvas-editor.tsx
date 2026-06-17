"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardPaste, Maximize, Minus, Plus, Trash2, Upload, Undo2, Redo2, MousePointer, Square } from "lucide-react"
import { CANVAS_SIZE, type Layer, createId } from "@/lib/editor-types"
import { CanvasLayer } from "@/components/canvas-layer"
import { LayersPanel } from "@/components/layers-panel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MIN_SCALE = 0.1
const MAX_SCALE = 2

function createBorderRectangleDataURL(width: number, height: number, color: string, borderWidth: number): string {
  if (typeof window === "undefined") return ""
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.strokeStyle = color
    ctx.lineWidth = borderWidth
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, Math.max(1, width - borderWidth), Math.max(1, height - borderWidth))
  }
  return canvas.toDataURL()
}

export function CanvasEditor() {
  const [history, setHistory] = useState<{
    past: Layer[][]
    present: Layer[]
    future: Layer[][]
  }>({
    past: [],
    present: [],
    future: [],
  })
  const layers = history.present

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState(0.4)
  const [isDragOver, setIsDragOver] = useState(false)
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })

  const [activeTool, setActiveTool] = useState<"select" | "rect-red" | "rect-green" | "rect-yellow">("select")

  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drawingPreviewRef = useRef<HTMLDivElement>(null)
  const cascadeRef = useRef(0)
  const preDragLayersRef = useRef<Layer[]>([])

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "select") return
      e.stopPropagation()
      const canvasEl = canvasRef.current
      const previewEl = drawingPreviewRef.current
      if (!canvasEl || !previewEl) return

      const rect = canvasEl.getBoundingClientRect()
      const startX = Math.round((e.clientX - rect.left) / scale)
      const startY = Math.round((e.clientY - rect.top) / scale)

      let latestRect = { x: startX, y: startY, width: 0, height: 0 }

      const colorHex = activeTool === "rect-red" ? "#ef4444" : activeTool === "rect-green" ? "#22c55e" : "#eab308"
      previewEl.style.display = "block"
      previewEl.style.borderColor = colorHex
      previewEl.style.left = `${startX}px`
      previewEl.style.top = `${startY}px`
      previewEl.style.width = "0px"
      previewEl.style.height = "0px"

      const handlePointerMove = (moveEvent: PointerEvent) => {
        // Caches rect using the parent scope's 'rect' bounding box to avoid layout thrashing
        const currentX = Math.round((moveEvent.clientX - rect.left) / scale)
        const currentY = Math.round((moveEvent.clientY - rect.top) / scale)

        const x = Math.min(startX, currentX)
        const y = Math.min(startY, currentY)
        const width = Math.abs(startX - currentX)
        const height = Math.abs(startY - currentY)

        latestRect = { x, y, width, height }

        // Manipulate DOM styles directly for maximum, stutter-free performance (bypasses React state updates)
        previewEl.style.left = `${x}px`
        previewEl.style.top = `${y}px`
        previewEl.style.width = `${width}px`
        previewEl.style.height = `${height}px`
      }

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)

        // Hide drawing preview
        previewEl.style.display = "none"

        if (latestRect.width > 5 && latestRect.height > 5) {
          const colorName = activeTool === "rect-red" ? "red" : activeTool === "rect-green" ? "green" : "yellow"
          const colorHex = activeTool === "rect-red" ? "#ef4444" : activeTool === "rect-green" ? "#22c55e" : "#eab308"
          
          const src = createBorderRectangleDataURL(latestRect.width, latestRect.height, colorHex, 5)
          
          const newLayer: Layer = {
            id: createId(),
            src,
            name: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} Rectangle`,
            x: latestRect.x,
            y: latestRect.y,
            width: latestRect.width,
            height: latestRect.height,
            naturalWidth: latestRect.width,
            naturalHeight: latestRect.height,
            visible: true,
          }

          setHistory((prev) => ({
            past: [...prev.past, prev.present],
            present: [...prev.present, newLayer],
            future: [],
          }))
          setSelectedId(newLayer.id)
        }

        setActiveTool("select")
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [activeTool, scale],
  )

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev
      const newPast = prev.past.slice(0, -1)
      const newPresent = prev.past[prev.past.length - 1]
      const newFuture = [prev.present, ...prev.future]
      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev
      const newFuture = prev.future.slice(1)
      const newPresent = prev.future[0]
      const newPast = [...prev.past, prev.present]
      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      }
    })
  }, [])

  const addImageFromSource = useCallback((src: string, name: string) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const maxDim = 700
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * r)
        h = Math.round(h * r)
      }
      const offset = (cascadeRef.current % 6) * 40
      cascadeRef.current += 1
      const x = Math.round(CANVAS_SIZE / 2 - w / 2 + offset)
      const y = Math.round(CANVAS_SIZE / 2 - h / 2 + offset)
      const layer: Layer = {
        id: createId(),
        src,
        name,
        x,
        y,
        width: w,
        height: h,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        visible: true,
      }
      setHistory((prev) => ({
        past: [...prev.past, prev.present],
        present: [...prev.present, layer],
        future: [],
      }))
      setSelectedId(layer.id)
    }
    img.src = src
  }, [])

  const addFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const base = file.name?.replace(/\.[^.]+$/, "") || "Pasted image"
          addImageFromSource(reader.result, base)
        }
      }
      reader.readAsDataURL(file)
    },
    [addImageFromSource],
  )

  // Clipboard paste
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            addFile(file)
          }
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [addFile])

  // Keyboard Undo/Redo shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return

      const isMac = typeof window !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (!isMac && modifier && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo])

  // Delete selected with keyboard
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault()
        deleteLayer(selectedId)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function updateLayer(id: string, patch: Partial<Layer>) {
    setHistory((prev) => ({
      ...prev,
      present: prev.present.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }

  function deleteLayer(id: string) {
    setHistory((prev) => ({
      past: [...prev.past, prev.present],
      present: prev.present.filter((l) => l.id !== id),
      future: [],
    }))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  function toggleVisible(id: string) {
    setHistory((prev) => ({
      past: [...prev.past, prev.present],
      present: prev.present.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      future: [],
    }))
  }

  function moveLayer(id: string, dir: "up" | "down") {
    setHistory((prev) => {
      const idx = prev.present.findIndex((l) => l.id === id)
      if (idx === -1) return prev
      const target = dir === "up" ? idx + 1 : idx - 1
      if (target < 0 || target >= prev.present.length) return prev
      const next = [...prev.present]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: [],
      }
    })
  }

  const handleDragStart = useCallback(() => {
    preDragLayersRef.current = history.present
  }, [history.present])

  const handleDragEnd = useCallback(() => {
    setHistory((prev) => ({
      past: [...prev.past, preDragLayersRef.current],
      present: prev.present,
      future: [],
    }))
  }, [])

  function zoomBy(delta: number) {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((s + delta).toFixed(2)))))
  }

  function fitToView() {
    const vp = viewportRef.current
    if (!vp) return
    const pad = 48
    const fit = Math.min((vp.clientWidth - pad) / CANVAS_SIZE, (vp.clientHeight - pad) / CANVAS_SIZE)
    setScale(Number(Math.max(MIN_SCALE, fit).toFixed(2)))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(addFile)
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">Image Board</h1>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {CANVAS_SIZE} × {CANVAS_SIZE}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
          <div className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground md:flex">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste with Ctrl/Cmd + V
          </div>

          <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground"
              onClick={undo}
              disabled={history.past.length === 0}
              aria-label="Undo"
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground"
              onClick={redo}
              disabled={history.future.length === 0}
              aria-label="Redo"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Tool Selector Group */}
          <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                activeTool === "select" ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setActiveTool("select")}
              aria-label="Select Tool"
              title="Select Tool"
            >
              <MousePointer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                activeTool === "rect-red" ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setActiveTool("rect-red")}
              aria-label="Red Rectangle Tool"
              title="Red Rectangle Tool"
            >
              <Square className="h-4 w-4 text-red-500 fill-red-500/20" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                activeTool === "rect-green" ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setActiveTool("rect-green")}
              aria-label="Green Rectangle Tool"
              title="Green Rectangle Tool"
            >
              <Square className="h-4 w-4 text-green-500 fill-green-500/20" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                activeTool === "rect-yellow" ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setActiveTool("rect-yellow")}
              aria-label="Yellow Rectangle Tool"
              title="Yellow Rectangle Tool"
            >
              <Square className="h-4 w-4 text-yellow-500 fill-yellow-500/20" />
            </Button>
          </div>

          <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomBy(-0.1)} aria-label="Zoom out">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-foreground">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomBy(0.1)} aria-label="Zoom in">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToView} aria-label="Fit to view">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHistory((prev) => ({
                past: [...prev.past, prev.present],
                present: [],
                future: [],
              }))
              setSelectedId(null)
            }}
            disabled={layers.length === 0}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas viewport */}
        <main
          ref={viewportRef}
          className="relative flex-1 overflow-auto bg-canvas p-6"
          onPointerDown={() => setSelectedId(null)}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <div style={{ width: CANVAS_SIZE * scale, height: CANVAS_SIZE * scale }}>
            <div
              ref={canvasRef}
              className={cn(
                "relative origin-top-left bg-background shadow-sm ring-1 ring-border",
                activeTool !== "select" ? "cursor-crosshair" : "cursor-default",
              )}
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                transform: `scale(${scale})`,
              }}
              onPointerDown={handleCanvasPointerDown}
            >
              <div className={cn(activeTool !== "select" && "pointer-events-none")}>
                {layers.map((layer) => (
                  <CanvasLayer
                    key={layer.id}
                    layer={layer}
                    selected={layer.id === selectedId}
                    scale={scale}
                    others={layers.filter((l) => l.id !== layer.id)}
                    onSelect={setSelectedId}
                    onChange={updateLayer}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onGuides={setGuides}
                  />
                ))}
              </div>

              {/* Drawing Rectangle Preview */}
              <div
                ref={drawingPreviewRef}
                className="absolute border-dashed pointer-events-none z-50"
                style={{
                  display: "none",
                  borderWidth: 5,
                  backgroundColor: "transparent",
                }}
              />

              {/* Alignment guide lines */}
              {guides.x.map((gx, i) => (
                <div
                  key={`gx-${i}`}
                  className="pointer-events-none absolute top-0 bg-selection"
                  style={{ left: gx, width: 1 / scale, height: CANVAS_SIZE }}
                />
              ))}
              {guides.y.map((gy, i) => (
                <div
                  key={`gy-${i}`}
                  className="pointer-events-none absolute left-0 bg-selection"
                  style={{ top: gy, height: 1 / scale, width: CANVAS_SIZE }}
                />
              ))}
            </div>
          </div>

          {isDragOver && (
            <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-lg border-2 border-dashed border-selection bg-background/60">
              <p className="text-sm font-medium text-foreground">Drop images to add</p>
            </div>
          )}
        </main>

        {/* Layers sidebar */}
        <aside className="w-72 shrink-0 border-l border-border bg-sidebar">
          <LayersPanel
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleVisible={toggleVisible}
            onDelete={deleteLayer}
            onMove={moveLayer}
          />
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(addFile)
          e.target.value = ""
        }}
      />
    </div>
  )
}
