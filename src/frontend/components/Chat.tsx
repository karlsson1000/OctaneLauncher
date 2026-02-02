import { useState, useEffect, useRef } from "react"
import { X, CornerRightUp, Lock, MessagesSquare } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { useTranslation } from "react-i18next"
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { GifPicker } from "./GifPicker"

interface Message {
  id: string
  from_uuid: string
  to_uuid: string
  content: string
  timestamp: string
  is_own: boolean
}

interface ChatProps {
  friendUuid: string
  friendUsername: string
  onClose: () => void
}

let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not configured')
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey)
  }
  return supabaseClient
}

export function Chat({
  friendUuid,
  friendUsername,
  onClose,
}: ChatProps) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [currentUserUuid, setCurrentUserUuid] = useState<string>("")
  const [currentUsername, setCurrentUsername] = useState<string>("")
  const [showGifPicker, setShowGifPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()

    // Get current user
    const initialize = async () => {
      try {
        // Get active account from backend
        const account = await invoke<{ uuid: string; username: string }>("get_active_account")
        setCurrentUserUuid(account.uuid)
        setCurrentUsername(account.username)
        
        // Load initial messages
        await loadMessages()
      } catch (error) {
        console.error("Failed to initialize:", error)
      }
    }

    initialize()
  }, [friendUuid])

  useEffect(() => {
    if (!currentUserUuid) return

    try {
      const supabase = getSupabaseClient()
      const channel = supabase
        .channel('chat_messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `or(and(from_uuid.eq.${currentUserUuid},to_uuid.eq.${friendUuid}),and(from_uuid.eq.${friendUuid},to_uuid.eq.${currentUserUuid}))`
          },
          async () => {
            await loadMessages()
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    } catch (error) {
      console.error('Failed to setup realtime subscription:', error)
    }
  }, [currentUserUuid, friendUuid])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadMessages = async () => {
    try {
      const msgs = await invoke<Message[]>("get_chat_messages", {
        friendUuid,
      })
      setMessages(msgs)
      setTimeout(() => scrollToBottom(), 100)
    } catch (error) {
      console.error("Failed to load messages:", error)
    }
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const handleSendMessage = async (content?: string) => {
    const messageText = content || inputMessage.trim()
    if (!messageText || isSending) return

    setInputMessage("")
    setIsSending(true)

    try {
      await invoke("send_chat_message", {
        toUuid: friendUuid,
        content: messageText,
      })
      await loadMessages()
      scrollToBottom()
    } catch (error) {
      console.error("Failed to send message:", error)
      if (!content) {
        setInputMessage(messageText)
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleGifSelect = (gifUrl: string) => {
    handleSendMessage(`[GIF]${gifUrl}`)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    const timestampNum = parseInt(timestamp)
    const date = new Date(timestampNum * 1000)
    const now = new Date()
    
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return `${hours}:${minutes}`
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  const isGifMessage = (content: string) => {
    return content.startsWith('[GIF]')
  }

  const getGifUrl = (content: string) => {
    return content.replace('[GIF]', '')
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
      <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div 
          className={`w-full max-w-2xl h-[600px] bg-[#1e2127] rounded-lg shadow-2xl flex flex-col overflow-hidden modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#2b2f38]">
            <div className="flex items-center gap-3">
              <img
                src={`https://cravatar.eu/avatar/${friendUsername}/32`}
                alt={friendUsername}
                className="w-8 h-8 rounded"
              />
              <div>
                <h2 className="text-sm font-semibold text-[#e6e6e6]">
                  {friendUsername}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-[#7d8590]">
                  <span>{t('chat.encrypted')}</span>
                  <Lock size={10} className="text-[#16a34a]" />
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-[#3a3f4b] rounded transition-colors cursor-pointer text-[#7d8590] hover:text-[#e6e6e6]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessagesSquare size={48} className="text-[#3a3f4b] mb-3" strokeWidth={1.5} />
                <p className="text-sm text-[#7d8590] mb-1">
                  {t('chat.noMessages')}
                </p>
                <p className="text-xs text-[#7d8590]/70">
                  {t('chat.sendFirst')}
                </p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const isOwn = message.from_uuid === currentUserUuid
                  const prevMessage = index > 0 ? messages[index - 1] : null
                  const isGrouped = prevMessage && prevMessage.from_uuid === message.from_uuid
                  
                  return (
                  <div
                    key={message.id}
                    className={`group px-3 -mx-3 hover:bg-[#22252b] transition-colors rounded ${isGrouped ? 'py-0.5' : 'py-0.5 mt-1'}`}
                  >
                    <div className={`flex gap-2 items-start ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {!isOwn && (
                        <div className="w-6 flex-shrink-0">
                          {!isGrouped && (
                            <img
                              src={`https://cravatar.eu/avatar/${friendUuid}/32`}
                              alt={friendUsername}
                              className="w-6 h-6 rounded"
                            />
                          )}
                        </div>
                      )}
                      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!isGrouped && (
                          <div className={`flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-xs font-semibold text-[#e6e6e6]">
                              {isOwn ? currentUsername : friendUsername}
                            </span>
                            <span className="text-[10px] text-[#7d8590]/70 leading-none">
                              {formatTimestamp(message.timestamp)}
                            </span>
                          </div>
                        )}
                        {isGifMessage(message.content) ? (
                          <div className="overflow-hidden rounded">
                            <img 
                              src={getGifUrl(message.content)} 
                              alt="GIF"
                              className="max-w-full max-h-[200px] object-contain rounded"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-[#d1d5db] break-words whitespace-pre-wrap leading-relaxed max-w-[500px]">
                            {message.content}
                          </p>
                        )}
                      </div>
                      {isOwn && (
                        <div className="w-6 flex-shrink-0">
                          {!isGrouped && (
                            <img
                              src={`https://cravatar.eu/avatar/${currentUserUuid}/32`}
                              alt="You"
                              className="w-6 h-6 rounded"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3 bg-[#2b2f38] relative">
            {showGifPicker && (
              <GifPicker 
                onSelect={handleGifSelect}
                onClose={() => setShowGifPicker(false)}
              />
            )}
            
            <div className="flex items-stretch gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('chat.typeMessage')}
                className="flex-1 bg-[#22252b] rounded px-3 py-2 text-sm text-[#e6e6e6] placeholder-[#7d8590] focus:outline-none focus:border-[#4572e3] transition-colors"
              />
              <button
                onClick={() => setShowGifPicker(!showGifPicker)}
                className="px-3 bg-[#22252b] hover:bg-[#32363f] rounded transition-colors cursor-pointer flex items-center justify-center text-[#7d8590] hover:text-[#e6e6e6] text-xs font-medium"
                title="Send GIF"
              >
                GIF
              </button>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isSending}
                className="px-4 bg-[#4572e3] hover:bg-[#3461d1] disabled:bg-[#3a3f4b] disabled:cursor-not-allowed text-white rounded transition-colors cursor-pointer flex items-center justify-center"
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CornerRightUp size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}