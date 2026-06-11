import { useState, useRef, Fragment } from "react"
import { ModsTab, ModsSelector } from "../mods/ModsTab"
import { ModpacksTab } from "../modpacks/ModpacksTab"
import { ResourcePacksTab } from "../resourcepacks/ResourcePacksTab"
import { ShaderPacksTab } from "../shaderpacks/ShaderPacksTab"
import { Puzzle, Layers, Image, Sparkles } from "lucide-react"
import type { Instance } from "../../types"

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

  const [selectedModpackVersion, setSelectedModpackVersion] = useState<string | null>(null)
  const [availableModpackVersions, setAvailableModpackVersions] = useState<string[]>([])
  const [isLoadingModpackVersions, setIsLoadingModpackVersions] = useState(false)

  const tabs = [
    { 
      id: "mods" as const, 
      label: "Mods", 
      subtitle: "Browse and install mods from Modrinth",
      icon: Puzzle,
      color: "text-[#16a34a]"
    },
    { 
      id: "modpacks" as const, 
      label: "Modpacks", 
      subtitle: "Discover complete modpacks from Modrinth",
      icon: Layers,
      color: "text-[#3b82f6]"
    },
    { 
      id: "resourcepacks" as const, 
      label: "Resource Packs", 
      subtitle: "Find resource packs on Modrinth",
      icon: Image,
      color: "text-[#8b5cf6]"
    },
    { 
      id: "shaderpacks" as const, 
      label: "Shader Packs", 
      subtitle: "Explore shader packs from Modrinth",
      icon: Sparkles,
      color: "text-[#f59e0b]"
    },
  ]

  const activeTab = tabs.find(tab => tab.id === activeSubTab)

  return (
    <div className="p-8 space-y-4" ref={scrollContainerRef}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              {tabs.map((tab, index) => {
                const Icon = tab.icon
                const isActive = activeSubTab === tab.id
                return (
                  <Fragment key={tab.id}>
                    <button
                      onClick={() => onSubTabChange(tab.id)}
                      className={`flex items-center gap-2 text-2xl font-semibold tracking-tight transition-colors cursor-pointer ${
                        isActive ? tab.color : "text-[#7d8590] hover:text-[#e6e6e6]"
                      }`}
                    >
                      <Icon size={24} strokeWidth={2} />
                      {tab.label && <span>{tab.label}</span>}
                    </button>
                    {index < tabs.length - 1 && (
                      <div className="h-8 w-px bg-[#3a3f4b]" />
                    )}
                  </Fragment>
                )
              })}
            </div>
            <p className="text-sm text-[#7d8590] mt-0.5">
              {activeTab?.subtitle}
            </p>
          </div>
          
          {(activeSubTab === "mods" || activeSubTab === "resourcepacks" || activeSubTab === "shaderpacks") && (
            <ModsSelector 
              instances={instances}
              selectedInstance={selectedInstance}
              onSetSelectedInstance={onSetSelectedInstance}
            />
          )}
        </div>
      </div>

      {activeSubTab === "mods" && (
        <ModsTab
          selectedInstance={selectedInstance}
          instances={instances}
          onSetSelectedInstance={onSetSelectedInstance}
          scrollContainerRef={scrollContainerRef}
        />
      )}

      {activeSubTab === "modpacks" && (
        <ModpacksTab
          instances={instances}
          onRefreshInstances={onRefreshInstances}
          selectedVersion={selectedModpackVersion}
          onSetSelectedVersion={setSelectedModpackVersion}
          availableVersions={availableModpackVersions}
          onSetAvailableVersions={setAvailableModpackVersions}
          isLoadingVersions={isLoadingModpackVersions}
          onSetIsLoadingVersions={setIsLoadingModpackVersions}
          onShowCreationToast={onShowCreationToast}
          scrollContainerRef={scrollContainerRef}
        />
      )}

      {activeSubTab === "resourcepacks" && (
        <ResourcePacksTab
          selectedInstance={selectedInstance}
          instances={instances}
          onSetSelectedInstance={onSetSelectedInstance}
          scrollContainerRef={scrollContainerRef}
        />
      )}

      {activeSubTab === "shaderpacks" && (
        <ShaderPacksTab
          selectedInstance={selectedInstance}
          instances={instances}
          onSetSelectedInstance={onSetSelectedInstance}
          scrollContainerRef={scrollContainerRef}
        />
      )}

    </div>
  )
}