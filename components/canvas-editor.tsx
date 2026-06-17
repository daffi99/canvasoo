"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardPaste, Maximize, Minus, Plus, Trash2, Upload } from "lucide-react"
import { CANVAS_SIZE, type Layer, createId } from "@/lib/editor-types"
import { CanvasLayer } from "@/components/canvas-layer"
import { LayersPanel } from "@/components/layers-panel"
import { Button } from "@/components/ui/button"

const MIN_SCALE = 0.1
const MAX_SCALE = 2

export function CanvasEditor() {
  const [layers, setLayers] = useState<Layer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState(0.4)
  const [isDragOver, setIsDragOver] = useState(false)
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })

  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cascadeRef = useRef(0)

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
      setLayers((prev) => [...prev, layer])
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
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function deleteLayer(id: string) {
    setLayers((prev) => prev.filter((l) => l.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  function toggleVisible(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)))
  }

  function moveLayer(id: string, dir: "up" | "down") {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx === -1) return prev
      const target = dir === "up" ? idx + 1 : idx - 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

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
              setLayers([])
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
              className="relative origin-top-left bg-background shadow-sm ring-1 ring-border"
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                transform: `scale(${scale})`,
              }}
            >
              {layers.map((layer) => (
                <CanvasLayer
                  key={layer.id}
                  layer={layer}
                  selected={layer.id === selectedId}
                  scale={scale}
                  others={layers.filter((l) => l.id !== layer.id)}
                  onSelect={setSelectedId}
                  onChange={updateLayer}
                  onGuides={setGuides}
                />
              ))}

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
