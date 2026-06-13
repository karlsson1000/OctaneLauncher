import { AlertCircle, X, CheckCircle, XCircle, Info } from "lucide-react"
import { useState } from "react"

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: "warning" | "danger" | "success" | "info"
  onConfirm: () => void
  onCancel: () => void
}

interface AlertModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  type?: "warning" | "danger" | "success" | "info"
  onClose: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  type = "warning",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [isClosing, setIsClosing] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onCancel()
    }, 150)
  }

  const handleConfirm = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onConfirm()
    }, 150)
  }

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <XCircle size={24} className="text-red-400" strokeWidth={2} />
      case "success":
        return <CheckCircle size={24} className="text-green-400" strokeWidth={2} />
      case "info":
        return <Info size={24} className="text-blue-400" strokeWidth={2} />
      case "warning":
      default:
        return <AlertCircle size={24} className="text-yellow-400" strokeWidth={2} />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (type) {
      case "danger":
        return "bg-red-500/10 hover:bg-red-500/20 text-red-400"
      case "success":
        return "bg-green-500/10 hover:bg-green-500/20 text-green-400"
      case "info":
        return "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
      case "warning":
      default:
        return "bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white"
    }
  }

  return (
    <>
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
        <div 
          className={`blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md modal-content ${isClosing ? 'closing' : ''}`} 
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-5">
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-line leading-snug">{message}</p>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              className="px-5 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover-strong)] text-[var(--text-primary)] rounded font-medium text-sm transition-colors cursor-pointer"
            >
              {cancelText || "Cancel"}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-5 py-3 rounded font-medium text-sm transition-colors cursor-pointer ${getConfirmButtonStyle()}`}
            >
              {confirmText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export function AlertModal({
  isOpen,
  title,
  message,
  confirmText,
  type = "info",
  onClose,
}: AlertModalProps) {
  const [isClosing, setIsClosing] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <XCircle size={24} className="text-red-400" strokeWidth={2} />
      case "success":
        return <CheckCircle size={24} className="text-green-400" strokeWidth={2} />
      case "info":
        return <Info size={24} className="text-blue-400" strokeWidth={2} />
      case "warning":
      default:
        return <AlertCircle size={24} className="text-yellow-400" strokeWidth={2} />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (type) {
      case "danger":
        return "bg-red-500/10 hover:bg-red-500/20 text-red-400"
      case "success":
        return "bg-green-500/10 hover:bg-green-500/20 text-green-400"
      case "info":
        return "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
      case "warning":
      default:
        return "bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white"
    }
  }

  return (
    <>
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
        <div 
          className={`blur-border bg-[var(--bg-secondary)] rounded w-full max-w-md modal-content ${isClosing ? 'closing' : ''}`} 
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">{title}</h2>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[var(--bg-hover-strong)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-5">
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-line leading-snug">{message}</p>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              className={`px-5 py-3 rounded font-medium text-sm transition-colors cursor-pointer ${getConfirmButtonStyle()}`}
            >
              {confirmText || "OK"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}