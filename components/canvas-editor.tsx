"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardPaste, Maximize, Minus, Plus, Trash2, Upload, Undo2, Redo2, MousePointer, Square, Scissors, Columns2, Rows2, Download, Palette, ImageIcon, FileText, Layers } from "lucide-react"
import { CANVAS_SIZE, type Layer, createId } from "@/lib/editor-types"
import { CanvasLayer } from "@/components/canvas-layer"
import { CanvasRuler } from "@/components/canvas-ruler"
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

interface CanvasEditorProps {
  splitDirection?: "horizontal" | "vertical"
  onToggleSplitDirection?: () => void
  viewMode?: "canvas" | "notepad" | "split"
  onViewModeChange?: (mode: "canvas" | "notepad" | "split") => void
}

export function CanvasEditor({
  splitDirection = "horizontal",
  onToggleSplitDirection,
  viewMode = "split",
  onViewModeChange,
}: CanvasEditorProps) {
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

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedId = selectedIds[0] ?? null

  const handleSelectLayer = useCallback((id: string, e?: React.PointerEvent | React.MouseEvent) => {
    if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      )
    } else {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [id]))
    }
  }, [])

  const handleBatchChange = useCallback((updates: Array<{ id: string; patch: Partial<Layer> }>) => {
    const patchMap = new Map(updates.map((u) => [u.id, u.patch]))
    setHistory((prev) => ({
      ...prev,
      present: prev.present.map((l) => {
        const patch = patchMap.get(l.id)
        return patch ? { ...l, ...patch } : l
      }),
    }))
  }, [])
  const [scale, setScale] = useState(0.55)
  const [isDragOver, setIsDragOver] = useState(false)
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9")
  const exportWidth = aspectRatio === "16:9" ? 1920 : 1080
  const exportHeight = aspectRatio === "16:9" ? 1080 : 1920

  const [userGuidelines, setUserGuidelines] = useState<Array<{ id: string; type: "horizontal" | "vertical"; position: number }>>([
    { id: "init-v-frame", type: "vertical", position: 1920 },
    { id: "init-h-frame", type: "horizontal", position: 1080 },
  ])
  const [draggingGuidelineId, setDraggingGuidelineId] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState("#ffffff")
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(false)

  const handleToggleAspectRatio = useCallback((ratio: "16:9" | "9:16") => {
    setAspectRatio(ratio)
    const newW = ratio === "16:9" ? 1920 : 1080
    const newH = ratio === "16:9" ? 1080 : 1920
    setUserGuidelines((prev) => {
      const filtered = prev.filter((g) => g.id !== "init-v-frame" && g.id !== "init-h-frame" && g.id !== "init-v-1920" && g.id !== "init-h-1080")
      return [
        ...filtered,
        { id: "init-v-frame", type: "vertical", position: newW },
        { id: "init-h-frame", type: "horizontal", position: newH },
      ]
    })
  }, [])

  const handleExportCanvas = useCallback(() => {
    const EXPORT_W = exportWidth
    const EXPORT_H = exportHeight
    const canvas = document.createElement("canvas")
    canvas.width = EXPORT_W
    canvas.height = EXPORT_H
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)

    const visibleLayers = layers.filter((l) => l.visible)
    if (visibleLayers.length === 0) {
      const link = document.createElement("a")
      link.download = `canvas-${EXPORT_W}x${EXPORT_H}-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      return
    }

    let loadedCount = 0
    const images: { img: HTMLImageElement; layer: Layer }[] = []

    visibleLayers.forEach((layer) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        images.push({ img, layer })
        loadedCount++
        if (loadedCount === visibleLayers.length) {
          visibleLayers.forEach((l) => {
            const found = images.find((item) => item.layer.id === l.id)
            if (found) {
              ctx.drawImage(found.img, l.x, l.y, l.width, l.height)
            }
          })
          const link = document.createElement("a")
          link.download = `canvas-${EXPORT_W}x${EXPORT_H}-${Date.now()}.png`
          link.href = canvas.toDataURL("image/png")
          link.click()
        }
      }
      img.src = layer.src
    })
  }, [layers, bgColor, exportWidth, exportHeight])

  const handleStartDragGuideline = useCallback(
    (type: "horizontal" | "vertical", e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const canvasEl = canvasRef.current
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()

      let initialPos = 0
      if (type === "horizontal") {
        initialPos = Math.round((e.clientY - rect.top) / scale)
      } else {
        initialPos = Math.round((e.clientX - rect.left) / scale)
      }

      const clampedInitialPos = Math.max(0, Math.min(CANVAS_SIZE, initialPos))
      const newId = createId()
      const newGuideline = {
        id: newId,
        type,
        position: clampedInitialPos,
      }

      setUserGuidelines((prev) => [...prev, newGuideline])
      setDraggingGuidelineId(newId)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        let currentPos = 0
        if (type === "horizontal") {
          currentPos = Math.round((moveEvent.clientY - rect.top) / scale)
        } else {
          currentPos = Math.round((moveEvent.clientX - rect.left) / scale)
        }

        if (currentPos < -30 || currentPos > CANVAS_SIZE + 30) {
          setUserGuidelines((prev) => prev.filter((g) => g.id !== newId))
        } else {
          const clamped = Math.max(0, Math.min(CANVAS_SIZE, currentPos))
          setUserGuidelines((prev) =>
            prev.map((g) => (g.id === newId ? { ...g, position: clamped } : g))
          )
        }
      }

      const handlePointerUp = () => {
        setDraggingGuidelineId(null)
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [scale],
  )

  const handleDragGuideline = useCallback(
    (id: string, type: "horizontal" | "vertical", e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const canvasEl = canvasRef.current
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()

      setDraggingGuidelineId(id)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        let newPos = 0
        if (type === "horizontal") {
          newPos = Math.round((moveEvent.clientY - rect.top) / scale)
        } else {
          newPos = Math.round((moveEvent.clientX - rect.left) / scale)
        }

        if (newPos < -30 || newPos > CANVAS_SIZE + 30) {
          setUserGuidelines((prev) => prev.filter((g) => g.id !== id))
        } else {
          const clampedPos = Math.max(0, Math.min(CANVAS_SIZE, newPos))
          setUserGuidelines((prev) =>
            prev.map((g) => (g.id === id ? { ...g, position: clampedPos } : g))
          )
        }
      }

      const handlePointerUp = () => {
        setDraggingGuidelineId(null)
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [scale],
  )

  const [activeTool, setActiveTool] = useState<"select" | "rect-red" | "rect-green" | "rect-yellow" | "split">("select")

  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const drawingPreviewRef = useRef<HTMLDivElement>(null)
  const cascadeRef = useRef(0)
  const preDragLayersRef = useRef<Layer[]>([])

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "select") {
        e.stopPropagation()
        const canvasEl = canvasRef.current
        const previewEl = drawingPreviewRef.current
        if (!canvasEl || !previewEl) return

        const rect = canvasEl.getBoundingClientRect()
        const startX = Math.round((e.clientX - rect.left) / scale)
        const startY = Math.round((e.clientY - rect.top) / scale)

        let latestRect = { x: startX, y: startY, width: 0, height: 0 }

        previewEl.style.display = "block"
        previewEl.style.borderColor = "#0f172a"
        previewEl.style.backgroundColor = "rgba(15, 23, 42, 0.12)"
        previewEl.style.borderStyle = "dashed"
        previewEl.style.left = `${startX}px`
        previewEl.style.top = `${startY}px`
        previewEl.style.width = "0px"
        previewEl.style.height = "0px"

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const currentX = Math.round((moveEvent.clientX - rect.left) / scale)
          const currentY = Math.round((moveEvent.clientY - rect.top) / scale)

          const x = Math.min(startX, currentX)
          const y = Math.min(startY, currentY)
          const width = Math.abs(startX - currentX)
          const height = Math.abs(startY - currentY)

          latestRect = { x, y, width, height }

          previewEl.style.left = `${x}px`
          previewEl.style.top = `${y}px`
          previewEl.style.width = `${width}px`
          previewEl.style.height = `${height}px`
        }

        const handlePointerUp = () => {
          window.removeEventListener("pointermove", handlePointerMove)
          window.removeEventListener("pointerup", handlePointerUp)

          previewEl.style.display = "none"
          previewEl.style.backgroundColor = "transparent"

          if (latestRect.width > 5 && latestRect.height > 5) {
            const mX = latestRect.x
            const mY = latestRect.y
            const mW = latestRect.width
            const mH = latestRect.height

            const matched = layers.filter((l) => {
              if (!l.visible) return false
              return l.x < mX + mW && l.x + l.width > mX && l.y < mY + mH && l.y + l.height > mY
            })

            setSelectedIds(matched.map((l) => l.id))
          } else {
            if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
              setSelectedIds([])
            }
          }
        }

        window.addEventListener("pointermove", handlePointerMove)
        window.addEventListener("pointerup", handlePointerUp)
        return
      }
      e.stopPropagation()
      const canvasEl = canvasRef.current
      const previewEl = drawingPreviewRef.current
      if (!canvasEl || !previewEl) return

      const rect = canvasEl.getBoundingClientRect()
      const startX = Math.round((e.clientX - rect.left) / scale)
      const startY = Math.round((e.clientY - rect.top) / scale)

      let latestRect = { x: startX, y: startY, width: 0, height: 0 }

      const colorHex =
        activeTool === "rect-red"
          ? "#ef4444"
          : activeTool === "rect-green"
            ? "#22c55e"
            : activeTool === "rect-yellow"
              ? "#eab308"
              : "#0ea5e9" // blue-500 for split tool
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
          if (activeTool === "split") {
            let targetLayer = layers.find((l) => l.id === selectedId)
            if (!targetLayer) {
              for (let i = layers.length - 1; i >= 0; i--) {
                const l = layers[i]
                if (!l.visible) continue
                const intersectX = Math.max(l.x, latestRect.x)
                const intersectY = Math.max(l.y, latestRect.y)
                const intersectRight = Math.min(l.x + l.width, latestRect.x + latestRect.width)
                const intersectBottom = Math.min(l.y + l.height, latestRect.y + latestRect.height)
                if (intersectRight > intersectX && intersectBottom > intersectY) {
                  targetLayer = l
                  break
                }
              }
            }

            if (targetLayer) {
              const layerToSplit = targetLayer
              const img = new Image()
              img.crossOrigin = "anonymous"
              img.onload = () => {
                const intersectX = Math.max(layerToSplit.x, latestRect.x)
                const intersectY = Math.max(layerToSplit.y, latestRect.y)
                const intersectRight = Math.min(layerToSplit.x + layerToSplit.width, latestRect.x + latestRect.width)
                const intersectBottom = Math.min(layerToSplit.y + layerToSplit.height, latestRect.y + latestRect.height)

                const intersectW = intersectRight - intersectX
                const intersectH = intersectBottom - intersectY

                if (intersectW <= 5 || intersectH <= 5) return

                const scaleX = layerToSplit.naturalWidth / layerToSplit.width
                const scaleY = layerToSplit.naturalHeight / layerToSplit.height

                const srcX = (intersectX - layerToSplit.x) * scaleX
                const srcY = (intersectY - layerToSplit.y) * scaleY
                const srcW = intersectW * scaleX
                const srcH = intersectH * scaleY

                // 1. Crop canvas
                const cropCanvas = document.createElement("canvas")
                cropCanvas.width = srcW
                cropCanvas.height = srcH
                const cropCtx = cropCanvas.getContext("2d")
                if (cropCtx) {
                  cropCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH)
                }
                const croppedPartSrc = cropCanvas.toDataURL()

                // 2. Original canvas (remove cropped portion)
                const origCanvas = document.createElement("canvas")
                origCanvas.width = layerToSplit.naturalWidth
                origCanvas.height = layerToSplit.naturalHeight
                const origCtx = origCanvas.getContext("2d")
                if (origCtx) {
                  origCtx.drawImage(img, 0, 0)
                  origCtx.clearRect(srcX, srcY, srcW, srcH)
                }
                const updatedOriginalSrc = origCanvas.toDataURL()

                const newLayerId = createId()
                const newLayer: Layer = {
                  id: newLayerId,
                  src: croppedPartSrc,
                  name: `${layerToSplit.name} (Split)`,
                  x: intersectX,
                  y: intersectY,
                  width: intersectW,
                  height: intersectH,
                  naturalWidth: srcW,
                  naturalHeight: srcH,
                  visible: true,
                }

                setHistory((prev) => {
                  const updatedPresent = prev.present.map((l) => {
                    if (l.id === layerToSplit.id) {
                      return { ...l, src: updatedOriginalSrc }
                    }
                    return l
                  })
                  const targetIdx = updatedPresent.findIndex((l) => l.id === layerToSplit.id)
                  const nextPresent = [...updatedPresent]
                  if (targetIdx !== -1) {
                    nextPresent.splice(targetIdx + 1, 0, newLayer)
                  } else {
                    nextPresent.push(newLayer)
                  }
                  return {
                    past: [...prev.past, prev.present],
                    present: nextPresent,
                    future: [],
                  }
                })
                setSelectedIds([newLayerId])
              }
              img.src = layerToSplit.src
            }
          } else {
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
            setSelectedIds([newLayer.id])
          }
        }

        setActiveTool("select")
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [activeTool, scale, layers, selectedId],
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
      setSelectedIds([layer.id])
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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault()
        const toDelete = new Set(selectedIds)
        setHistory((prev) => ({
          past: [...prev.past, prev.present],
          present: prev.present.filter((l) => !toDelete.has(l.id)),
          future: [],
        }))
        setSelectedIds([])
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedIds])

  function updateLayer(id: string, patch: Partial<Layer>) {
    setHistory((prev) => ({
      ...prev,
      present: prev.present.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }

  function deleteLayer(id: string) {
    const idsToDelete = selectedIds.includes(id) ? new Set(selectedIds) : new Set([id])
    setHistory((prev) => ({
      past: [...prev.past, prev.present],
      present: prev.present.filter((l) => !idsToDelete.has(l.id)),
      future: [],
    }))
    setSelectedIds((prev) => prev.filter((i) => !idsToDelete.has(i)))
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
    <div className="flex h-full w-full flex-col bg-background">
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
          <Button variant="outline" size="sm" onClick={handleExportCanvas} title={`Export top-left ${exportWidth}×${exportHeight} area as PNG`}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export ({exportWidth}×{exportHeight})</span>
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
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                activeTool === "split" ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setActiveTool("split")}
              aria-label="Split Image Tool"
              title="Split Image Tool"
            >
              <Scissors className="h-4 w-4 text-sky-500 fill-sky-500/20" />
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

          {/* Canvas Background Color Picker */}
          <div className="ml-1 flex items-center gap-1.5 rounded-md border border-border p-0.5" title="Change Canvas Background Color">
            <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded p-1 hover:bg-accent">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
              />
            </label>
            <div
              className="h-4 w-4 shrink-0 rounded-full border border-border shadow-sm mr-0.5"
              style={{ backgroundColor: bgColor }}
            />
          </div>

          {/* Aspect Ratio Switcher */}
          <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border p-0.5" title="Canvas Aspect Ratio">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs font-semibold", aspectRatio === "16:9" ? "bg-accent text-foreground" : "text-muted-foreground")}
              onClick={() => handleToggleAspectRatio("16:9")}
              title="16:9 Landscape (1920×1080)"
            >
              16:9
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs font-semibold", aspectRatio === "9:16" ? "bg-accent text-foreground" : "text-muted-foreground")}
              onClick={() => handleToggleAspectRatio("9:16")}
              title="9:16 Portrait (1080×1920)"
            >
              9:16
            </Button>
          </div>

          {onToggleSplitDirection && viewMode === "split" && (
            <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-foreground"
                onClick={onToggleSplitDirection}
                aria-label={splitDirection === "horizontal" ? "Switch to vertical layout" : "Switch to horizontal layout"}
                title={splitDirection === "horizontal" ? "Switch to vertical layout" : "Switch to horizontal layout"}
              >
                {splitDirection === "horizontal" ? (
                  <Rows2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Columns2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          )}

          {onViewModeChange && (
            <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", viewMode === "canvas" ? "bg-accent text-foreground" : "text-muted-foreground")}
                onClick={() => onViewModeChange("canvas")}
                title="Image Board Only"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", viewMode === "split" ? "bg-accent text-foreground" : "text-muted-foreground")}
                onClick={() => onViewModeChange("split")}
                title="Split View"
              >
                <Columns2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", viewMode === "notepad" ? "bg-accent text-foreground" : "text-muted-foreground")}
                onClick={() => onViewModeChange("notepad")}
                title="Note Only"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 gap-1 px-2 text-xs", isLayersCollapsed ? "text-muted-foreground" : "bg-accent text-foreground")}
            onClick={() => setIsLayersCollapsed(!isLayersCollapsed)}
            title={isLayersCollapsed ? "Show Layers Section" : "Hide Layers Section"}
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Layers</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHistory((prev) => ({
                past: [...prev.past, prev.present],
                present: [],
                future: [],
              }))
              setSelectedIds([])
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
          onPointerDown={() => setSelectedIds([])}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
        >
          <div style={{ width: CANVAS_SIZE * scale + 24, height: CANVAS_SIZE * scale + 24, position: "relative" }}>
            <CanvasRuler scale={scale} onStartDragGuideline={handleStartDragGuideline} />
            <div
              ref={canvasRef}
              className={cn(
                "absolute top-[24px] left-[24px] origin-top-left shadow-sm ring-1 ring-border",
                activeTool !== "select" ? "cursor-crosshair" : "cursor-default",
              )}
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                transform: `scale(${scale})`,
                backgroundColor: bgColor,
              }}
              onPointerDown={handleCanvasPointerDown}
            >
              <div className={cn(activeTool !== "select" && "pointer-events-none")}>
                {layers.map((layer) => (
                  <CanvasLayer
                    key={layer.id}
                    layer={layer}
                    selected={selectedIds.includes(layer.id)}
                    scale={scale}
                    others={layers.filter((l) => l.id !== layer.id)}
                    allLayers={layers}
                    selectedIds={selectedIds}
                    userGuidelines={userGuidelines}
                    onSelect={handleSelectLayer}
                    onChange={updateLayer}
                    onBatchChange={handleBatchChange}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onGuides={setGuides}
                  />
                ))}
              </div>

              {/* Active Export Frame Overlay */}
              <div
                className="pointer-events-none absolute top-0 left-0 border-2 border-dashed border-cyan-500/35 z-30"
                style={{
                  width: exportWidth,
                  height: exportHeight,
                }}
              >
                <span className="absolute bottom-1 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 shadow-sm border border-cyan-500/30 select-none">
                  {exportWidth} × {exportHeight} ({aspectRatio})
                </span>
              </div>

              {/* User Created Figma Guidelines */}
              {userGuidelines.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "absolute z-40 touch-none select-none group",
                    g.type === "horizontal"
                      ? "left-0 w-full cursor-ns-resize border-t-2 border-dashed border-cyan-400 hover:border-cyan-300"
                      : "top-0 h-full cursor-ew-resize border-l-2 border-dashed border-cyan-400 hover:border-cyan-300"
                  )}
                  style={
                    g.type === "horizontal"
                      ? { top: g.position, height: 0 }
                      : { left: g.position, width: 0 }
                  }
                  onPointerDown={(e) => handleDragGuideline(g.id, g.type, e)}
                >
                  <div
                    className={cn(
                      "absolute bg-slate-900/90 text-cyan-300 border border-cyan-400/50 text-xs sm:text-sm font-mono font-bold px-2.5 py-1 rounded-md shadow-xl pointer-events-none whitespace-nowrap transition-opacity backdrop-blur-sm",
                      draggingGuidelineId === g.id ? "opacity-100 scale-105 z-50 ring-2 ring-cyan-400" : "opacity-0 group-hover:opacity-100",
                      g.type === "horizontal" ? "left-6 -top-9" : "top-6 left-3"
                    )}
                  >
                    {g.type === "horizontal" ? `Y: ${g.position}px` : `X: ${g.position}px`}
                  </div>
                </div>
              ))}

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
        {!isLayersCollapsed && (
          <aside className="w-72 shrink-0 border-l border-border bg-sidebar">
            <LayersPanel
              layers={layers}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={handleSelectLayer}
              onToggleVisible={toggleVisible}
              onDelete={deleteLayer}
              onMove={moveLayer}
              onToggleCollapse={() => setIsLayersCollapsed(true)}
            />
          </aside>
        )}
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
