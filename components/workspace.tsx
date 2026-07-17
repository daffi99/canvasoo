"use client"

import { useState, useRef, useCallback } from "react"
import { CanvasEditor } from "@/components/canvas-editor"
import { Notepad } from "@/components/notepad"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function Workspace() {
  const [leftWidth, setLeftWidth] = useState(70) // percentage
  const [splitDirection, setSplitDirection] = useState<"horizontal" | "vertical">("horizontal")
  const [isNotepadCollapsed, setIsNotepadCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const lastWidthRef = useRef(70)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      let newWidth = 70
      if (splitDirection === "horizontal") {
        newWidth = (moveEvent.clientX / window.innerWidth) * 100
      } else {
        newWidth = (moveEvent.clientY / window.innerHeight) * 100
      }
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
  }, [splitDirection])

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
    <div className={cn("flex h-dvh w-full overflow-hidden bg-background", splitDirection === "horizontal" ? "flex-row" : "flex-col")}>
      {/* Left Panel: Canvas Editor */}
      <div
        className="min-w-0 min-h-0"
        style={{
          width: splitDirection === "horizontal" ? (isNotepadCollapsed ? "100%" : `${leftWidth}%`) : "100%",
          height: splitDirection === "vertical" ? (isNotepadCollapsed ? "100%" : `${leftWidth}%`) : "100%",
          transition: isDragging ? "none" : (splitDirection === "horizontal" ? "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)" : "height 0.25s cubic-bezier(0.4, 0, 0.2, 1)"),
        }}
      >
        <CanvasEditor
          splitDirection={splitDirection}
          onToggleSplitDirection={() => setSplitDirection((prev) => (prev === "horizontal" ? "vertical" : "horizontal"))}
        />
      </div>

      {/* Resizable Divider */}
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "relative z-40 flex shrink-0 items-center justify-center bg-border transition-colors hover:bg-selection/60",
          splitDirection === "horizontal" ? "w-1 cursor-col-resize" : "h-1 w-full cursor-row-resize",
          isDragging && "bg-selection",
        )}
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={toggleNotepad}
          className={cn(
            "absolute flex cursor-pointer items-center justify-center rounded-md border border-border bg-popover shadow-sm transition-transform hover:bg-accent",
            splitDirection === "horizontal" ? "h-8 w-5" : "h-5 w-8"
          )}
          style={{ transform: "translate(0px)" }}
          aria-label={isNotepadCollapsed ? "Expand notepad" : "Collapse notepad"}
          title={isNotepadCollapsed ? "Expand notepad" : "Collapse notepad"}
        >
          {splitDirection === "horizontal" ? (
            isNotepadCollapsed ? (
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            isNotepadCollapsed ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )
          )}
        </button>
      </div>

      {/* Right Panel: Notepad */}
      <div
        className={cn(
          "min-w-0 min-h-0 overflow-hidden bg-background",
          splitDirection === "horizontal" ? "border-l border-border" : "border-t border-border"
        )}
        style={{
          width: splitDirection === "horizontal" ? (isNotepadCollapsed ? "0%" : `${100 - leftWidth}%`) : "100%",
          height: splitDirection === "vertical" ? (isNotepadCollapsed ? "0%" : `${100 - leftWidth}%`) : "100%",
          transition: isDragging ? "none" : (splitDirection === "horizontal" ? "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)" : "height 0.25s cubic-bezier(0.4, 0, 0.2, 1)"),
          display: isNotepadCollapsed ? "none" : "block",
        }}
      >
        <Notepad />
      </div>
    </div>
  )
}
