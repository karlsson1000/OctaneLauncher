import { useState, useRef, Fragment, useCallback } from "react"
import { ModsTab, ModsSelector } from "../modrinth/ModsTab"
import { ModpacksTab } from "../modrinth/ModpacksTab"
import { ResourcePacksTab } from "../modrinth/ResourcePacksTab"
import { ShaderPacksTab } from "../modrinth/ShaderPacksTab"
import { CurseforgeModsTab } from "../curseforge/ModsTab"
import { CurseforgeModpacksTab } from "../curseforge/ModpacksTab"
import { CurseforgeResourcePacksTab } from "../curseforge/ResourcePacksTab"
import { CurseforgeShaderPacksTab } from "../curseforge/ShaderPacksTab"
import { Search, Puzzle, Layers, Image, Sparkles } from "lucide-react"
import type { Instance } from "../../types"

type ContentSource = "modrinth" | "curseforge"

interface BrowseTabProps {
  selectedInstance: Instance | null
  instances: Instance[]
  onSetSelectedInstance: (instance: Instance) => void
  onRefreshInstances?: () => void
  onShowCreationToast?: (instanceName: string) => void
  activeSubTab: "mods" | "modpacks" | "resourcepacks" | "shaderpacks"
  onSubTabChange: (tab: "mods" | "modpacks" | "resourcepacks" | "shaderpacks") => void
}

export function BrowseTab({ 
  selectedInstance, 
  instances, 
  onSetSelectedInstance, 
  onRefreshInstances, 
  onShowCreationToast,
  activeSubTab,
  onSubTabChange,
}: BrowseTabProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [contentSource, setContentSource] = useState<ContentSource>("modrinth")
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const sourceDropdownRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const placeholderMap: Record<string, string> = {
    mods: "Search mods...",
    modpacks: "Search modpacks...",
    resourcepacks: "Search resource packs...",
    shaderpacks: "Search shader packs...",
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  const tabs = [
    { id: "mods" as const, label: "Mods", icon: Puzzle, color: "text-[#16a34a]" },
    { id: "modpacks" as const, label: "Modpacks", icon: Layers, color: "text-[#3b82f6]" },
    { id: "resourcepacks" as const, label: "Resource Packs", icon: Image, color: "text-[#8b5cf6]" },
    { id: "shaderpacks" as const, label: "Shader Packs", icon: Sparkles, color: "text-[#f59e0b]" },
  ]

  const modsSelector = (
    <ModsSelector
      instances={instances}
      selectedInstance={selectedInstance}
      onSetSelectedInstance={onSetSelectedInstance}
    />
  )

  const sourceSelector = (
    <div className="relative" ref={sourceDropdownRef}>
      <button
        onClick={() => setShowSourceDropdown(!showSourceDropdown)}
        className="w-10 h-10 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
      >
        <img
          src={contentSource === "modrinth" ? "/modrinth.svg" : "/curseforge.svg"}
          alt={contentSource}
          className="w-6 h-6"
        />
      </button>
      {showSourceDropdown && (
        <div className="absolute top-full mt-2 left-0 bg-[var(--bg-tertiary)] rounded-md overflow-hidden z-50 min-w-[140px] shadow-lg">
          <button
            onClick={() => { setContentSource("modrinth"); setShowSourceDropdown(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${contentSource === "modrinth" ? "bg-[#16a34a]/10 text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
          >
            <img src="/modrinth.svg" alt="Modrinth" className="w-6 h-6" />
            Modrinth
          </button>
          <button
            onClick={() => { setContentSource("curseforge"); setShowSourceDropdown(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${contentSource === "curseforge" ? "bg-[#f97316]/20 text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
          >
            <img src="/curseforge.svg" alt="CurseForge" className="w-6 h-6" />
            CurseForge
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden" ref={scrollContainerRef}>
      <div className="flex-shrink-0 px-8 pt-8 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              {tabs.map((tab, index) => {
                const Icon = tab.icon
                const isActive = activeSubTab === tab.id
                return (
                  <Fragment key={tab.id}>
                    <button
                      onClick={() => onSubTabChange(tab.id)}
                      className={`flex items-center gap-2 text-2xl font-semibold tracking-tight transition-colors cursor-pointer ${
                        isActive ? tab.color : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <Icon size={24} strokeWidth={2} />
                      {tab.label && <span>{tab.label}</span>}
                    </button>
                    {index < tabs.length - 1 && (
                      <div className="h-8 w-px bg-[var(--bg-hover-strong)]" />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </div>
      </div>

      <div className="flex-shrink-0 px-8 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 items-stretch">
            {sourceSelector}
            <div className="relative flex-1 rounded-md bg-[var(--bg-tertiary)]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-20 pointer-events-none" strokeWidth={2} />
              <input
                type="text"
                placeholder={placeholderMap[activeSubTab]}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-transparent rounded-md pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition-all relative z-10"
              />
            </div>
            {modsSelector}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-8 overflow-hidden">
        {contentSource === "modrinth" ? (
          <>
            {activeSubTab === "mods" && (
              <ModsTab
                selectedInstance={selectedInstance}
                instances={instances}
                onSetSelectedInstance={onSetSelectedInstance}
                scrollContainerRef={scrollContainerRef}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}

            {activeSubTab === "modpacks" && (
              <ModpacksTab
                instances={instances}
                onRefreshInstances={onRefreshInstances}
                onShowCreationToast={onShowCreationToast}
                scrollContainerRef={scrollContainerRef}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}

            {activeSubTab === "resourcepacks" && (
              <ResourcePacksTab
                selectedInstance={selectedInstance}
                scrollContainerRef={scrollContainerRef}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}

            {activeSubTab === "shaderpacks" && (
              <ShaderPacksTab
                selectedInstance={selectedInstance}
                scrollContainerRef={scrollContainerRef}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}
          </>
        ) : (
          <>
            {activeSubTab === "mods" && (
              <CurseforgeModsTab
                selectedInstance={selectedInstance}
                instances={instances}
                onSetSelectedInstance={onSetSelectedInstance}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}

            {activeSubTab === "modpacks" && (
              <CurseforgeModpacksTab
                instances={instances}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
                onShowCreationToast={onShowCreationToast}
                onRefreshInstances={onRefreshInstances}
              />
            )}

            {activeSubTab === "resourcepacks" && (
              <CurseforgeResourcePacksTab
                selectedInstance={selectedInstance}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}

            {activeSubTab === "shaderpacks" && (
              <CurseforgeShaderPacksTab
                selectedInstance={selectedInstance}
                hideToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}