import { AlertCircle, CheckCircle, Info, X } from "lucide-react"

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
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <AlertCircle size={24} className="text-red-400" strokeWidth={2} />
      case "success":
        return <CheckCircle size={24} className="text-[#16a34a]" strokeWidth={2} />
      case "info":
        return <Info size={24} className="text-blue-400" strokeWidth={2} />
      default:
        return <AlertCircle size={24} className="text-yellow-400" strokeWidth={2} />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (type) {
      case "danger":
        return "bg-red-500/90 hover:bg-red-500"
      case "success":
        return "bg-[#16a34a] hover:bg-[#15803d]"
      default:
        return "bg-[#16a34a] hover:bg-[#15803d]"
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-md w-full max-w-md">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e8e8e8] tracking-tight">{title}</h2>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-1.5 hover:bg-[#0d0d0d] rounded transition-colors text-[#808080] hover:text-[#e8e8e8] cursor-pointer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm text-[#e8e8e8] whitespace-pre-line leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#0a0a0a] text-[#e8e8e8] rounded font-medium text-sm transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded font-medium text-sm transition-all cursor-pointer ${getConfirmButtonStyle()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AlertModal({
  isOpen,
  title,
  message,
  confirmText = "OK",
  type = "info",
  onClose,
}: AlertModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <AlertCircle size={24} className="text-red-400" strokeWidth={2} />
      case "success":
        return <CheckCircle size={24} className="text-[#16a34a]" strokeWidth={2} />
      case "info":
        return <Info size={24} className="text-blue-400" strokeWidth={2} />
      default:
        return <AlertCircle size={24} className="text-yellow-400" strokeWidth={2} />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (type) {
      case "danger":
        return "bg-red-500/90 hover:bg-red-500"
      case "success":
        return "bg-[#16a34a] hover:bg-[#15803d]"
      default:
        return "bg-[#16a34a] hover:bg-[#15803d]"
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-md w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e8e8e8] tracking-tight">{title}</h2>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-[#0d0d0d] rounded transition-colors text-[#808080] hover:text-[#e8e8e8] cursor-pointer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm text-[#e8e8e8] whitespace-pre-line leading-relaxed">{message}</p>
        </div>

        <div className="flex p-5 pt-0">
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2.5 text-white rounded font-medium text-sm transition-all cursor-pointer ${getConfirmButtonStyle()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}