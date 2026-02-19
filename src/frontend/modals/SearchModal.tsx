import { useState, useEffect, useRef } from "react"
import { Search, X, Package, Settings, Server, User, Puzzle, Home, Terminal, Map, ChevronRight, Clock, FileArchive, FolderOpen, Copy, Trash2, Play, Plus, LogIn } from "lucide-react"

interface SearchResult {
  type: "instance" | "setting" | "server" | "skin" | "mod" | "page" | "action"
  title: string
  description?: string
  icon?: React.ReactNode
  action: () => void
  category: string
  keywords?: string[]
}

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
  instances: any[]
  onNavigateToInstance: (instance: any) => void
  onNavigateToTab: (tab: string) => void
  onOpenSettings: () => void
  isAuthenticated?: boolean
  onCreateInstance?: () => void
  onAddAccount?: () => void
  onLaunchInstance?: (instance: any) => void
  onOpenInstanceFolder?: (instance: any) => void
  onExportInstance?: (instance: any) => void
  onDuplicateInstance?: (instance: any) => void
  onDeleteInstance?: (instanceName: string) => void
  onAddServer?: () => void
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  instances,
  onNavigateToInstance,
  onNavigateToTab,
  onOpenSettings,
  isAuthenticated = false,
  onCreateInstance,
  onAddAccount,
  onLaunchInstance,
  onOpenInstanceFolder,
  onExportInstance,
  onDuplicateInstance,
  onDeleteInstance,
  onAddServer,
}: GlobalSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isClosing, setIsClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setSearchQuery("")
      setSelectedIndex(0)
      setIsClosing(false)
      loadRecentSearches()
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  const loadRecentSearches = () => {
    try {
      const saved = localStorage.getItem("recent_searches")
      if (saved) {
        setRecentSearches(JSON.parse(saved))
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error)
    }
  }

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return

    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
      setRecentSearches(updated)
      localStorage.setItem("recent_searches", JSON.stringify(updated))
    } catch (error) {
      console.error("Failed to save recent search:", error)
    }
  }

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 150)
  }

  const allResults: SearchResult[] = [
    // Pages
    {
      type: "page",
      title: "Home",
      description: "View your recent instances and latest Minecraft updates",
      icon: <Home size={18} />,
      action: () => {
        onNavigateToTab("home")
        handleClose()
      },
      category: "Pages",
      keywords: ["home", "dashboard", "overview", "recent", "snapshots"]
    },
    {
      type: "page",
      title: "Instances",
      description: "Manage all your Minecraft instances",
      icon: <Package size={18} />,
      action: () => {
        onNavigateToTab("instances")
        handleClose()
      },
      category: "Pages",
      keywords: ["instances", "minecraft", "profiles", "manage"]
    },
    {
      type: "page",
      title: "Browse Mods",
      description: "Browse and install mods from Modrinth",
      icon: <Puzzle size={18} />,
      action: () => {
        onNavigateToTab("browse")
        handleClose()
      },
      category: "Pages",
      keywords: ["mods", "browse", "modrinth", "addons", "modifications", "plugins"]
    },
    {
      type: "page",
      title: "Browse Modpacks",
      description: "Browse and install modpacks from Modrinth",
      icon: <Package size={18} />,
      action: () => {
        onNavigateToTab("browse")
        handleClose()
      },
      category: "Pages",
      keywords: ["modpacks", "browse", "modrinth", "packs", "collections"]
    },
    {
      type: "page",
      title: "Servers",
      description: "Manage your multiplayer servers",
      icon: <Server size={18} />,
      action: () => {
        onNavigateToTab("servers")
        handleClose()
      },
      category: "Pages",
      keywords: ["servers", "multiplayer", "online", "join", "connect"]
    },
    {
      type: "page",
      title: "Skins",
      description: "Manage your Minecraft character skins",
      icon: <User size={18} />,
      action: () => {
        onNavigateToTab("skins")
        handleClose()
      },
      category: "Pages",
      keywords: ["skins", "character", "appearance", "customization", "avatar"]
    },
    {
      type: "page",
      title: "Server Maps",
      description: "View interactive server maps",
      icon: <Map size={18} />,
      action: () => {
        onNavigateToTab("map")
        handleClose()
      },
      category: "Pages",
      keywords: ["maps", "server maps", "world", "explore", "dynmap"]
    },
    {
      type: "page",
      title: "Console",
      description: "View game logs and output",
      icon: <Terminal size={18} />,
      action: () => {
        onNavigateToTab("console")
        handleClose()
      },
      category: "Pages",
      keywords: ["console", "logs", "debug", "output", "terminal", "crash"]
    },

    // Settings
    {
      type: "setting",
      title: "Settings",
      description: "Configure launcher preferences",
      icon: <Settings size={18} />,
      action: () => {
        onOpenSettings()
        handleClose()
      },
      category: "Settings",
      keywords: ["settings", "preferences", "configuration", "options"]
    },
    {
      type: "setting",
      title: "Java Settings",
      description: "Configure Java memory and arguments",
      icon: <Settings size={18} />,
      action: () => {
        onOpenSettings()
        handleClose()
      },
      category: "Settings",
      keywords: ["java", "memory", "ram", "jvm", "arguments", "performance", "allocation"]
    },
    {
      type: "setting",
      title: "Appearance Settings",
      description: "Customize launcher appearance and sidebar background",
      icon: <Settings size={18} />,
      action: () => {
        onOpenSettings()
        handleClose()
      },
      category: "Settings",
      keywords: ["appearance", "theme", "background", "sidebar", "customization", "visual"]
    },
    {
      type: "setting",
      title: "Language Settings",
      description: "Change launcher language",
      icon: <Settings size={18} />,
      action: () => {
        onOpenSettings()
        handleClose()
      },
      category: "Settings",
      keywords: ["language", "locale", "translation", "international", "deutsch", "español", "français"]
    },
    {
      type: "setting",
      title: "Discord Integration",
      description: "Configure Discord Rich Presence",
      icon: <Settings size={18} />,
      action: () => {
        onOpenSettings()
        handleClose()
      },
      category: "Settings",
      keywords: ["discord", "rich presence", "integration", "status", "activity"]
    },
    {
      type: "setting",
      title: "Game Directory",
      description: "Change where instances are stored",
      icon: <Settings size={18} />,
      action: () => {
        onOpenSettings()
        handleClose()
      },
      category: "Settings",
      keywords: ["directory", "folder", "location", "path", "storage", "files"]
    },

    // Quick Actions
    {
      type: "action",
      title: "Create New Instance",
      description: "Create a new Minecraft instance",
      icon: <Plus size={18} />,
      action: () => {
        if (onCreateInstance) {
          onCreateInstance()
        } else {
          onNavigateToTab("instances")
        }
        handleClose()
      },
      category: "Quick Actions",
      keywords: ["create", "new", "instance", "add", "make", "setup"]
    },
    {
      type: "action",
      title: "Add Server",
      description: "Add a new multiplayer server",
      icon: <Server size={18} />,
      action: () => {
        if (onAddServer) {
          onAddServer()
        } else {
          onNavigateToTab("servers")
        }
        handleClose()
      },
      category: "Quick Actions",
      keywords: ["add", "server", "multiplayer", "join", "connect", "new"]
    },
    ...(isAuthenticated ? [] : [{
      type: "action" as const,
      title: "Sign In",
      description: "Sign in with your Microsoft account",
      icon: <LogIn size={18} />,
      action: () => {
        if (onAddAccount) {
          onAddAccount()
        }
        handleClose()
      },
      category: "Quick Actions",
      keywords: ["sign in", "login", "account", "microsoft", "authenticate", "auth"]
    }]),

    // Instance Actions
    ...instances.map(instance => ({
      type: "instance" as const,
      title: instance.name,
      description: `Minecraft ${instance.version} • ${instance.loader || "Vanilla"}`,
      icon: <Package size={18} />,
      action: () => {
        onNavigateToInstance(instance)
        handleClose()
      },
      category: "Instances",
      keywords: [instance.name.toLowerCase(), instance.version, instance.loader, "instance", "minecraft", "play", "launch"]
    })),
    ...instances.map(instance => ({
      type: "action" as const,
      title: `Play ${instance.name}`,
      description: `Launch ${instance.name}`,
      icon: <Play size={18} />,
      action: () => {
        if (onLaunchInstance) {
          onLaunchInstance(instance)
        } else {
          onNavigateToInstance(instance)
        }
        handleClose()
      },
      category: "Instance Actions",
      keywords: ["play", "launch", "run", "start", instance.name.toLowerCase()]
    })),
    ...instances.map(instance => ({
      type: "action" as const,
      title: `Open ${instance.name} Folder`,
      description: `Open instance folder in file explorer`,
      icon: <FolderOpen size={18} />,
      action: () => {
        if (onOpenInstanceFolder) {
          onOpenInstanceFolder(instance)
        } else {
          onNavigateToInstance(instance)
        }
        handleClose()
      },
      category: "Instance Actions",
      keywords: ["open", "folder", "directory", "files", instance.name.toLowerCase(), "explorer"]
    })),
    ...instances.map(instance => ({
      type: "action" as const,
      title: `Export ${instance.name}`,
      description: `Export instance as modpack`,
      icon: <FileArchive size={18} />,
      action: () => {
        if (onExportInstance) {
          onExportInstance(instance)
        } else {
          onNavigateToInstance(instance)
        }
        handleClose()
      },
      category: "Instance Actions",
      keywords: ["export", "backup", "modpack", "share", instance.name.toLowerCase(), "mrpack"]
    })),
    ...instances.map(instance => ({
      type: "action" as const,
      title: `Duplicate ${instance.name}`,
      description: `Create a copy of this instance`,
      icon: <Copy size={18} />,
      action: () => {
        if (onDuplicateInstance) {
          onDuplicateInstance(instance)
        } else {
          onNavigateToInstance(instance)
        }
        handleClose()
      },
      category: "Instance Actions",
      keywords: ["duplicate", "copy", "clone", instance.name.toLowerCase()]
    })),
    ...instances.map(instance => ({
      type: "action" as const,
      title: `Delete ${instance.name}`,
      description: `Remove this instance`,
      icon: <Trash2 size={18} />,
      action: () => {
        if (onDeleteInstance) {
          onDeleteInstance(instance.name)
        } else {
          onNavigateToInstance(instance)
        }
        handleClose()
      },
      category: "Instance Actions",
      keywords: ["delete", "remove", "uninstall", instance.name.toLowerCase()]
    })),

    // Console Actions
    {
      type: "action",
      title: "View Console Logs",
      description: "View game output and debug logs",
      icon: <Terminal size={18} />,
      action: () => {
        onNavigateToTab("console")
        handleClose()
      },
      category: "Quick Actions",
      keywords: ["console", "logs", "output", "debug", "crash", "error", "view"]
    },
    {
      type: "action",
      title: "Upload Logs to mclo.gs",
      description: "Share console logs online",
      icon: <Terminal size={18} />,
      action: () => {
        onNavigateToTab("console")
        handleClose()
      },
      category: "Quick Actions",
      keywords: ["upload", "logs", "share", "mclo.gs", "paste", "console"]
    },
  ]

  const filteredResults = searchQuery.trim()
    ? allResults.filter(result => {
        const query = searchQuery.toLowerCase()
        const searchableText = [
          result.title,
          result.description || "",
          result.category,
          ...(result.keywords || [])
        ].join(" ").toLowerCase()

        return searchableText.includes(query)
      })
    : allResults.slice(0, 8)

  const groupedResults = filteredResults.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = []
    }
    acc[result.category].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredResults.length - 1))
      scrollToSelected()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
      scrollToSelected()
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      e.preventDefault()
      saveRecentSearch(searchQuery)
      filteredResults[selectedIndex].action()
    } else if (e.key === "Escape") {
      handleClose()
    }
  }

  const scrollToSelected = () => {
    setTimeout(() => {
      const selected = resultsRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
      if (selected) {
        selected.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }, 0)
  }

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(searchQuery)
    result.action()
  }

  if (!isOpen) return null

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
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3a3f4b;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #454a58;
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
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          backdrop-filter: blur(8px);
          z-index: 10;
          transition: none !important;
        }

        .blur-border:hover::before {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.04)
          );
        }
      `}</style>

      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-24 p-4 modal-backdrop ${isClosing ? 'closing' : ''}`}
        onClick={handleClose}
      >
        <div
          className={`blur-border w-full max-w-2xl bg-[#181a1f] rounded shadow-2xl overflow-hidden modal-content ${isClosing ? 'closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: 'auto' }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Search size={20} className="text-[#7d8590] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search instances, settings, and more..."
              className="flex-1 bg-transparent text-[#e6e6e6] placeholder-[#7d8590] outline-none text-base"
            />
            <button
              onClick={handleClose}
              className="p-1 hover:bg-[#3a3f4b] rounded transition-colors text-[#7d8590] hover:text-[#e6e6e6] cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Results */}
          <div
            ref={resultsRef}
            className="max-h-[500px] overflow-y-auto custom-scrollbar"
          >
            {!searchQuery.trim() && recentSearches.length > 0 && (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#7d8590] uppercase tracking-wider mb-2">
                  <Clock size={12} />
                  Recent Searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => setSearchQuery(search)}
                      className="px-2 py-1 bg-[#22252b] hover:bg-[#3a3f4b] text-[#7d8590] hover:text-[#e6e6e6] rounded text-sm transition-colors cursor-pointer"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredResults.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Search size={48} className="text-[#3a3f4b] mx-auto mb-3" />
                <p className="text-[#7d8590] text-sm">No results found</p>
                <p className="text-[#3a3f4b] text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              Object.entries(groupedResults).map(([category, results]) => (
                <div key={category} className="last:border-b-0">
                  <div className="px-4 py-2 bg-[#22252b] text-xs font-semibold text-[#7d8590] uppercase tracking-wider">
                    {category}
                  </div>
                  {results.map((result) => {
                    const globalIndex = filteredResults.indexOf(result)
                    const isSelected = globalIndex === selectedIndex

                    return (
                      <button
                        key={globalIndex}
                        data-index={globalIndex}
                        onClick={() => handleResultClick(result)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left cursor-pointer ${
                          isSelected
                            ? "bg-[#3a3f4b]"
                            : "hover:bg-[#2a2f3b]"
                        }`}
                      >
                        <div className={`flex-shrink-0 ${
                          result.type === "instance" ? "text-[#16a34a]" :
                          result.type === "setting" ? "text-[#3b82f6]" :
                          result.type === "page" ? "text-[#7d8590]" :
                          "text-[#f97316]"
                        }`}>
                          {result.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#e6e6e6] truncate">
                            {result.title}
                          </div>
                          {result.description && (
                            <div className="text-xs text-[#7d8590] truncate mt-0.5">
                              {result.description}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-[#3a3f4b] flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-[#22252b] flex items-center justify-between text-xs text-[#7d8590]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#181a1f] rounded border border-[#3a3f4b]">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-[#181a1f] rounded border border-[#3a3f4b]">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#181a1f] rounded border border-[#3a3f4b]">Enter</kbd>
                to select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#181a1f] rounded border border-[#3a3f4b]">Esc</kbd>
                to close
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
