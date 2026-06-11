import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
  const [position, setPosition] = useState({ x, y })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  useLayoutEffect(() => {
    if (!menuRef.current) return
    const { width, height } = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    setPosition({
      x: x + width  > vw ? vw - width  - 8 : x,
      y: y + height > vh ? vh - height - 8 : y,
    })
  }, [x, y])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[#181a1f] rounded-md overflow-hidden min-w-[180px] border border-[#ffffff14]"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) =>
        item.separator ? (
          <div key={index} className="h-px bg-[#22252b] my-1 mx-2" />
        ) : (
          <button
            key={index}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors cursor-pointer ${
              item.danger
                ? "text-red-400 hover:bg-red-500/10"
                : "text-[#e6e6e6] hover:bg-[#3a3f4b]"
            }`}
          >
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  )
}