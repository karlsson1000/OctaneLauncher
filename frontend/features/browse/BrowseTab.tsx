import { useState, useRef, Fragment } from "react"
import { ModsTab, ModsSelector } from "../modrinth/ModsTab"
import { ModpacksTab } from "../modrinth/ModpacksTab"
import { ResourcePacksTab } from "../modrinth/ResourcePacksTab"
import { ShaderPacksTab } from "../modrinth/ShaderPacksTab"
import { CurseforgeModsTab } from "../curseforge/ModsTab"
import { CurseforgeModpacksTab } from "../curseforge/ModpacksTab"
import { CurseforgeResourcePacksTab } from "../curseforge/ResourcePacksTab"
import { CurseforgeShaderPacksTab } from "../curseforge/ShaderPacksTab"
import { Puzzle, Layers, Image, Sparkles } from "lucide-react"
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

  const tabs = [
    { id: "mods" as const, label: "Mods", icon: Puzzle, color: "text-[#16a34a]" },
    { id: "modpacks" as const, label: "Modpacks", icon: Layers, color: "text-[#3b82f6]" },
    { id: "resourcepacks" as const, label: "Resource Packs", icon: Image, color: "text-[#8b5cf6]" },
    { id: "shaderpacks" as const, label: "Shader Packs", icon: Sparkles, color: "text-[#f59e0b]" },
  ]

  const sourceSelector = (
    <div className="relative" ref={sourceDropdownRef}>
      <button
        onClick={() => setShowSourceDropdown(!showSourceDropdown)}
        className="w-10 h-10 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors cursor-pointer"
      >
        <img
          src={contentSource === "modrinth" ? "/modrinth.svg" : "/curseforge.svg"}
          alt={contentSource}
          className="w-5 h-5"
        />
      </button>
      {showSourceDropdown && (
        <div className="absolute top-full mt-1 left-0 bg-[var(--bg-tertiary)] rounded-md overflow-hidden z-50 min-w-[140px] shadow-lg">
          <button
            onClick={() => { setContentSource("modrinth"); setShowSourceDropdown(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${contentSource === "modrinth" ? "bg-[#16a34a]/10 text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
          >
            <img src="/modrinth.svg" alt="Modrinth" className="w-5 h-5" />
            Modrinth
          </button>
          <button
            onClick={() => { setContentSource("curseforge"); setShowSourceDropdown(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${contentSource === "curseforge" ? "bg-[#f97316]/40 text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
          >
            <img src="/curseforge.svg" alt="CurseForge" className="w-5 h-5" />
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
          <div className="grid grid-cols-[1fr_auto] items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
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

            <ModsSelector 
              instances={instances}
              selectedInstance={selectedInstance}
              onSetSelectedInstance={onSetSelectedInstance}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-8 pb-8">
        {contentSource === "modrinth" ? (
          <>
            {activeSubTab === "mods" && (
              <ModsTab
                selectedInstance={selectedInstance}
                instances={instances}
                onSetSelectedInstance={onSetSelectedInstance}
                scrollContainerRef={scrollContainerRef}
                sourceSelector={sourceSelector}
              />
            )}

            {activeSubTab === "modpacks" && (
              <ModpacksTab
                instances={instances}
                onRefreshInstances={onRefreshInstances}
                onShowCreationToast={onShowCreationToast}
                scrollContainerRef={scrollContainerRef}
                sourceSelector={sourceSelector}
              />
            )}

            {activeSubTab === "resourcepacks" && (
              <ResourcePacksTab
                selectedInstance={selectedInstance}
                scrollContainerRef={scrollContainerRef}
                sourceSelector={sourceSelector}
              />
            )}

            {activeSubTab === "shaderpacks" && (
              <ShaderPacksTab
                selectedInstance={selectedInstance}
                scrollContainerRef={scrollContainerRef}
                sourceSelector={sourceSelector}
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
                sourceSelector={sourceSelector}
              />
            )}

            {activeSubTab === "modpacks" && (
              <CurseforgeModpacksTab
                instances={instances}
                sourceSelector={sourceSelector}
                onShowCreationToast={onShowCreationToast}
                onRefreshInstances={onRefreshInstances}
              />
            )}

            {activeSubTab === "resourcepacks" && (
              <CurseforgeResourcePacksTab
                selectedInstance={selectedInstance}
                sourceSelector={sourceSelector}
              />
            )}

            {activeSubTab === "shaderpacks" && (
              <CurseforgeShaderPacksTab
                selectedInstance={selectedInstance}
                sourceSelector={sourceSelector}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}