import { useEffect, useRef, useMemo } from "react"
import { createPortal } from "react-dom"

interface ContextMenuItem {
  label?: string
  icon?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8
      }

      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8
      }

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [x, y])

  const menuContent = useMemo(() => (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[#141414] border border-[#2a2a2a] rounded-md shadow-lg overflow-hidden min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        item.separator ? (
          <div key={index} className="h-px bg-[#2a2a2a] my-1 mx-2" />
        ) : (
          <button
            key={index}
            onClick={() => {
              if (item.onClick) {
                item.onClick()
              }
              onClose()
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
              item.danger
                ? "text-red-400 hover:bg-red-500/10"
                : "text-[#e6edf3] hover:bg-[#1a1a1a]"
            }`}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      ))}
    </div>
  ), [x, y, items, onClose])

  return createPortal(menuContent, document.body)
}