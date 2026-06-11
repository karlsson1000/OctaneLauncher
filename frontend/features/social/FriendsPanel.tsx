import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Users, UserPlus, UserCheck, UserX, Search, Loader2, LogIn } from "lucide-react"
import type { Friend, FriendRequest } from "../../types"

interface FriendsPanelProps {
  isOpen: boolean
  isAuthenticated: boolean
}

export function FriendsPanel({ isOpen, isAuthenticated }: FriendsPanelProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadFriends()
      loadRequests()
    }
  }, [isOpen, isAuthenticated])

  const loadFriends = async () => {
    setIsLoading(true)
    try {
      const result = await invoke<Friend[]>("get_friends")
      setFriends(result)
    } catch (error) {
      console.error("Failed to load friends:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadRequests = async () => {
    try {
      const result = await invoke<FriendRequest[]>("get_friend_requests")
      setRequests(result)
    } catch (error) {
      console.error("Failed to load requests:", error)
    }
  }

  const handleSendRequest = async (username: string) => {
    if (!username.trim()) return
    setSending(true)
    setSendError(null)
    try {
      await invoke("send_friend_request", { username: username.trim() })
      setSearchQuery("")
      loadRequests()
    } catch (error) {
      setSendError(String(error))
    } finally {
      setSending(false)
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await invoke("accept_friend_request", { requestId })
      setRequests(prev => prev.filter(r => r.id !== requestId))
      loadFriends()
    } catch (error) {
      console.error("Failed to accept request:", error)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      await invoke("reject_friend_request", { requestId })
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error) {
      console.error("Failed to reject request:", error)
    }
  }

  const handleRemoveFriend = async (friendUuid: string) => {
    try {
      await invoke("remove_friend", { friendUuid })
      setFriends(prev => prev.filter(f => f.uuid !== friendUuid))
    } catch (error) {
      console.error("Failed to remove friend:", error)
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "online": return <span title="Online"><div className="w-2 h-2 rounded-full bg-[#16a34a] ring-2 ring-[#15171c]" /></span>
      case "ingame": return <span title="In Game"><div className="w-2 h-2 rounded-full bg-[#3b82f6] ring-2 ring-[#15171c]" /></span>
      default: return <span title="Offline"><div className="w-2 h-2 rounded-full bg-[#4a4f5b] ring-2 ring-[#15171c]" /></span>
    }
  }

  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedFriends = [...filteredFriends].sort((a, b) => {
    const order: Record<string, number> = { ingame: 0, online: 1, offline: 2 }
    return (order[a.status] ?? 2) - (order[b.status] ?? 2)
  })

  return (
    <div
      ref={panelRef}
      className={`flex-shrink-0 bg-[#15171c] flex flex-col h-full overflow-hidden transition-all duration-200 ease-in-out ${
        isOpen ? "w-60" : "w-0 -mr-4"
      }`}
    >
      <div className="flex items-center gap-2 px-1 pt-2 pb-1">
        <span className="text-xl font-semibold text-[#e6e6e6]">Friends</span>
        {friends.length > 0 && (
          <span className="text-xs text-[#7d8590]">({friends.filter(f => f.status === "online" || f.status === "ingame").length} online)</span>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center px-1 py-6 text-center">
          <LogIn size={32} className="text-[#3a3f4b] mb-3" />
          <p className="text-sm text-[#7d8590]">Sign in to see your friends</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-1 pt-1 pb-1 space-y-1">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a4f5b]" />
              <input
                type="text"
                placeholder="Search or add friends..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSendError(null) }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim() && !friends.some(f => f.username.toLowerCase() === searchQuery.trim().toLowerCase())) {
                    handleSendRequest(searchQuery.trim())
                  }
                }}
                className="w-full bg-[#22252b] rounded pl-8 pr-2 py-1.5 text-xs text-[#e6e6e6] placeholder-[#4a4f5b] focus:outline-none"
              />
            </div>

            {searchQuery.trim() && !friends.some(f => f.username.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <button
                onClick={() => handleSendRequest(searchQuery.trim())}
                disabled={sending}
                className="w-full flex items-center gap-2 px-1 py-1.5 rounded text-xs text-[#7d8590] hover:bg-[#22252b] hover:text-[#e6e6e6] transition-colors cursor-pointer"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} strokeWidth={3} />}
                Send friend request to "{searchQuery.trim()}"
              </button>
            )}
            {sendError && <p className="text-xs text-red-400 px-1">{sendError}</p>}
          </div>

          {requests.length > 0 && (
            <div>
              <div className="px-1 py-2 text-xs font-semibold text-[#7d8590] uppercase tracking-wider">
                Pending Requests ({requests.length})
              </div>
              <div className="max-h-40 overflow-y-auto">
                {requests.map(req => (
                  <div key={req.id} className="flex items-center gap-2 px-1 py-2 hover:bg-[#22252b] transition-colors">
                    <div className="w-6 h-6 rounded bg-[#22252b] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[#7d8590]">
                        {req.from_username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#e6e6e6] truncate">{req.from_username}</div>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      className="p-1 hover:bg-[#16a34a]/20 rounded text-[#7d8590] hover:text-[#16a34a] transition-colors cursor-pointer"
                      title="Accept"
                    >
                      <UserCheck size={16} strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="p-1 hover:bg-red-500/20 rounded text-[#7d8590] hover:text-red-400 transition-colors cursor-pointer"
                      title="Reject"
                    >
                      <UserX size={16} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[#16a34a]" />
              </div>
            ) : sortedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-1">
                <Users size={32} className="text-[#3a3f4b] mb-3" />
                <p className="text-sm text-[#7d8590]">No friends yet</p>
                <p className="text-xs text-[#3a3f4b] mt-1">Send a friend request to get started</p>
              </div>
            ) : (
              <div className="py-1">
                {sortedFriends.map(friend => (
                  <div
                    key={friend.uuid}
                    className="group flex items-center gap-2.5 px-1 py-1.5"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={`https://avatar.mcindex.net/avatar/${friend.username}/28`}
                        alt={friend.username}
                        className="w-7 h-7 rounded object-cover"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5">
                        {statusIcon(friend.status)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#e6e6e6] truncate font-medium">{friend.username}</div>
                      <div className="text-[13px] text-[#7d8590] truncate -mt-0.5">
                        {friend.status === "ingame" && friend.current_instance
                          ? `Playing ${friend.current_instance}`
                          : friend.status === "online"
                          ? "Online"
                          : "Offline"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFriend(friend.uuid)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-[#7d8590] hover:text-red-400 transition-all cursor-pointer"
                      title="Remove friend"
                    >
                      <UserX size={16} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}