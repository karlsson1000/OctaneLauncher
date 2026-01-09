import { AlertCircle, CheckCircle, Info, X } from "lucide-react"
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
  confirmText = "Confirm",
  cancelText = "Cancel",
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
        return <AlertCircle size={24} className="text-red-400" strokeWidth={2} />
      case "success":
        return <CheckCircle size={24} className="text-[#238636]" strokeWidth={2} />
      case "info":
        return <Info size={24} className="text-blue-400" strokeWidth={2} />
      default:
        return <AlertCircle size={24} className="text-yellow-400" strokeWidth={2} />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (type) {
      case "danger":
        return "bg-red-500/20 hover:bg-red-500/30 text-red-400"
      case "success":
        return "bg-[#238636] hover:bg-[#2ea043] text-white"
      default:
        return "bg-[#238636] hover:bg-[#2ea043] text-white"
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scaleOut {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .modal-backdrop.closing {
          animation: fadeOut 0.15s ease-in forwards;
        }
        .modal-content {
          animation: scaleIn 0.15s ease-out forwards;
        }
        .modal-content.closing {
          animation: scaleOut 0.15s ease-in forwards;
        }
      `}</style>
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
        <div className={`bg-[#141414] border border-[#2a2a2a] rounded-md w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e6edf3] tracking-tight">{title}</h2>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors text-[#7d8590] hover:text-[#e6edf3] cursor-pointer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm text-[#e6edf3] whitespace-pre-line leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-[#0f0f0f] hover:bg-[#1a1a1a] text-[#e6edf3] rounded-md font-medium text-sm transition-all cursor-pointer border border-[#2a2a2a]"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all cursor-pointer ${type === 'danger' ? '' : 'shadow-sm'} ${getConfirmButtonStyle()}`}
          >
            {confirmText}
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
  confirmText = "OK",
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
        return <AlertCircle size={24} className="text-red-400" strokeWidth={2} />
      case "success":
        return <CheckCircle size={24} className="text-[#238636]" strokeWidth={2} />
      case "info":
        return <Info size={24} className="text-blue-400" strokeWidth={2} />
      default:
        return <AlertCircle size={24} className="text-yellow-400" strokeWidth={2} />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (type) {
      case "danger":
        return "bg-red-500/20 hover:bg-red-500/30 text-red-400"
      case "success":
        return "bg-[#238636] hover:bg-[#2ea043] text-white"
      default:
        return "bg-[#238636] hover:bg-[#2ea043] text-white"
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scaleOut {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .modal-backdrop.closing {
          animation: fadeOut 0.15s ease-in forwards;
        }
        .modal-content {
          animation: scaleIn 0.15s ease-out forwards;
        }
        .modal-content.closing {
          animation: scaleOut 0.15s ease-in forwards;
        }
      `}</style>
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
        <div className={`bg-[#141414] border border-[#2a2a2a] rounded-md w-full max-w-md shadow-2xl modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#e6edf3] tracking-tight">{title}</h2>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors text-[#7d8590] hover:text-[#e6edf3] cursor-pointer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm text-[#e6edf3] whitespace-pre-line leading-relaxed">{message}</p>
        </div>

        <div className="flex p-5 pt-0">
          <button
            onClick={handleClose}
            className={`flex-1 px-4 py-2.5 rounded-md font-medium text-sm transition-all cursor-pointer ${type === 'danger' ? '' : 'shadow-sm'} ${getConfirmButtonStyle()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}