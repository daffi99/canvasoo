"use client"

import { ArrowDown, ArrowUp, Eye, EyeOff, ImageIcon, Trash2 } from "lucide-react"
import type { Layer } from "@/lib/editor-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LayersPanelProps {
  layers: Layer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisible: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: "up" | "down") => void
}

export function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onToggleVisible,
  onDelete,
  onMove,
}: LayersPanelProps) {
  // Top-most layer (last in array) should appear first in the list.
  const ordered = [...layers].reverse()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">Layers</h2>
        <span className="text-xs text-muted-foreground">{layers.length}</span>
      </div>

      {ordered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-pretty text-sm text-muted-foreground">
            Paste an image with{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
              Ctrl/Cmd + V
            </kbd>{" "}
            or upload one to add a layer.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2">
          {ordered.map((layer) => {
            const isSelected = layer.id === selectedId
            return (
              <li key={layer.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(layer.id)
                    }
                  }}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors",
                    isSelected
                      ? "border-selection bg-accent"
                      : "border-transparent hover:bg-accent/60",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={layer.src || "/placeholder.svg"}
                      alt=""
                      className={cn("h-full w-full object-contain", !layer.visible && "opacity-30")}
                    />
                  </div>

                  <span className="flex-1 truncate text-sm text-foreground">{layer.name}</span>

                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMove(layer.id, "up")
                      }}
                      aria-label="Move layer up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMove(layer.id, "down")
                      }}
                      aria-label="Move layer down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleVisible(layer.id)
                      }}
                      aria-label={layer.visible ? "Hide layer" : "Show layer"}
                    >
                      {layer.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(layer.id)
                      }}
                      aria-label="Delete layer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
