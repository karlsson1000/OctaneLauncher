import { AlertCircle, X, CheckCircle, XCircle, Info } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
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
        return "bg-[#4572e3] hover:bg-[#3461d1] text-white"
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
        
        .blur-border {
          position: relative;
        }

        .blur-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          ) !important;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          backdrop-filter: blur(8px);
          z-index: 10;
        }
        
        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          ) !important;
        }
      `}</style>
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
        <div 
          className={`blur-border bg-[#181a1f] rounded w-full max-w-md modal-content ${isClosing ? 'closing' : ''}`} 
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">{title}</h2>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-5">
            <p className="text-sm text-[#e6e6e6] whitespace-pre-line leading-snug">{message}</p>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              className="px-5 py-3 bg-[#22252b] hover:bg-[#3a3f4b] text-[#e6e6e6] rounded font-medium text-sm transition-colors cursor-pointer"
            >
              {cancelText || t('common.actions.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-5 py-3 rounded font-medium text-sm transition-colors cursor-pointer ${getConfirmButtonStyle()}`}
            >
              {confirmText || t('modal.confirm')}
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
  const { t } = useTranslation()
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
        return "bg-[#4572e3] hover:bg-[#3461d1] text-white"
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
        
        .blur-border {
          position: relative;
        }

        .blur-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          ) !important;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          backdrop-filter: blur(8px);
          z-index: 10;
        }
        
        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          ) !important;
        }
      `}</style>
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
        <div 
          className={`blur-border bg-[#181a1f] rounded w-full max-w-md modal-content ${isClosing ? 'closing' : ''}`} 
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#e6e6e6] tracking-tight">{title}</h2>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors text-gray-400 hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 pb-5">
            <p className="text-sm text-[#e6e6e6] whitespace-pre-line leading-snug">{message}</p>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              className={`px-5 py-3 rounded font-medium text-sm transition-colors cursor-pointer ${getConfirmButtonStyle()}`}
            >
              {confirmText || t('modal.ok')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}