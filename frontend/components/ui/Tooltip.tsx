import { useRef, useState } from "react"
import { createPortal } from "react-dom"

interface TooltipProps {
  text: string
  children: React.ReactNode
}

export function Tooltip({ text, children }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  const rect = ref.current?.getBoundingClientRect()

  const themeClass = typeof document !== "undefined"
    ? Array.from(document.querySelector("[class*='theme-']")?.classList ?? []).find(c => c.startsWith("theme-")) ?? ""
    : ""

  return (
    <div
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && rect && createPortal(
        <div
          className={`fixed z-[100] pointer-events-none whitespace-nowrap ${themeClass}`}
          style={{ left: rect.right + 8, top: rect.top + rect.height / 2 }}
        >
          <div className="bg-[var(--bg-secondary)] rounded-md px-2 py-1 border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] -translate-y-1/2">
            {text}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}