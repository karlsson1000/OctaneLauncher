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

  return (
    <div
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && rect && createPortal(
        <div
          className="fixed z-[100] pointer-events-none whitespace-nowrap"
          style={{ left: rect.right + 8, top: rect.top + rect.height / 2 }}
        >
          <div className="bg-[#181a1f] rounded-md px-2 py-1 border border-[#ffffff14] text-sm text-[#e6e6e6] -translate-y-1/2">
            {text}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
