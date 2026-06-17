"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code2,
  Code,
  Undo2,
  Redo2,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export function Notepad() {
  const [title, setTitle] = useState("")

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something here...",
      }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[calc(100dvh-12rem)] text-sm text-foreground px-8 pb-16 outline-none",
      },
    },
  })

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading editor...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top formatting bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-1">
          {/* Text formatting group */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("bold") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("italic") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("strike") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("code") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Heading group */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("heading", { level: 1 }) ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("heading", { level: 2 }) ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* List group */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("bulletList") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("orderedList") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Block type group */}
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("blockquote") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              "h-7 w-7 rounded p-1 transition-colors hover:bg-accent",
              editor.isActive("codeBlock") ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            title="Code Block"
          >
            <Code2 className="h-4 w-4" />
          </button>
        </div>

        {/* Undo / Redo group */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="h-7 w-7 rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="h-7 w-7 rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Editor Page Container */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Note Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Note"
            className="mb-6 w-full bg-transparent px-8 text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
          />

          {/* Tiptap Rich Text Editor */}
          <EditorContent editor={editor} className="tiptap" />
        </div>
      </div>
    </div>
  )
}
