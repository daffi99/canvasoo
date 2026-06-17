"use client"

import { useState, useRef, useCallback } from "react"
import { CanvasEditor } from "@/components/canvas-editor"
import { Notepad } from "@/components/notepad"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function Workspace() {
  const [leftWidth, setLeftWidth] = useState(70) // percentage
  const [isNotepadCollapsed, setIsNotepadCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const lastWidthRef = useRef(70)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const newWidth = (moveEvent.clientX / window.innerWidth) * 100
      const clampedWidth = Math.max(20, Math.min(80, newWidth))
      setLeftWidth(clampedWidth)
      lastWidthRef.current = clampedWidth
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }, [])

  const toggleNotepad = useCallback(() => {
    setIsNotepadCollapsed((prev) => {
      if (prev) {
        setLeftWidth(lastWidthRef.current)
        return false
      } else {
        setLeftWidth(100)
        return true
      }
    })
  }, [])

  const handleDoubleClick = useCallback(() => {
    setLeftWidth(70)
    lastWidthRef.current = 70
    setIsNotepadCollapsed(false)
  }, [])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Left Panel: Canvas Editor */}
      <div
        className="h-full min-w-0"
        style={{
          width: isNotepadCollapsed ? "100%" : `${leftWidth}%`,
          transition: isDragging ? "none" : "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <CanvasEditor />
      </div>

      {/* Resizable Divider */}
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "relative z-40 flex w-1 shrink-0 cursor-col-resize items-center justify-center bg-border transition-colors hover:bg-selection/60",
          isDragging && "bg-selection",
        )}
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={toggleNotepad}
          className="absolute flex h-8 w-5 cursor-pointer items-center justify-center rounded-md border border-border bg-popover shadow-sm transition-transform hover:bg-accent"
          style={{ transform: "translateX(0px)" }}
          aria-label={isNotepadCollapsed ? "Expand notepad" : "Collapse notepad"}
          title={isNotepadCollapsed ? "Expand notepad" : "Collapse notepad"}
        >
          {isNotepadCollapsed ? (
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Right Panel: Notepad */}
      <div
        className="h-full min-w-0 overflow-hidden border-l border-border bg-background"
        style={{
          width: isNotepadCollapsed ? "0%" : `${100 - leftWidth}%`,
          transition: isDragging ? "none" : "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          display: isNotepadCollapsed ? "none" : "block",
        }}
      >
        <Notepad />
      </div>
    </div>
  )
}
