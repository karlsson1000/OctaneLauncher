import { Suspense, lazy } from "react"
import { Loader2 } from "lucide-react"
import { useLauncherState } from "./hooks/useLauncherState"
import { TitleBar } from "./components/layout/TitleBar"
import { Sidebar } from "./components/layout/Sidebar"
import { FriendsPanel } from "./features/social/FriendsPanel"
import { SettingsModal } from "./features/settings/SettingsModal"
import { CreateInstanceModal } from "./features/instances/CreateInstanceModal"
import { CreationProgressToast } from "./features/instances/CreationProgressToast"
import { InstanceDetailsTab } from "./features/instances/InstanceDetailsTab"
import { ConfirmModal, AlertModal } from "./components/ui/ConfirmModal"

const HomeTab = lazy(() => import("./features/home/HomeTab").then(m => ({ default: m.HomeTab })))
const InstancesTab = lazy(() => import("./features/instances/InstancesTab").then(m => ({ default: m.InstancesTab })))
const BrowseTab = lazy(() => import("./features/browse/BrowseTab").then(m => ({ default: m.BrowseTab })))
const ConsoleTab = lazy(() => import("./features/console/ConsoleTab").then(m => ({ default: m.ConsoleTab })))
const ServersTab = lazy(() => import("./features/servers/ServersTab").then(m => ({ default: m.ServersTab })))
const SkinsTab = lazy(() => import("./features/skins/SkinsTab").then(m => ({ default: m.SkinsTab })))
const ScreenshotsTab = lazy(() => import("./features/screenshots/ScreenshotsTab").then(m => ({ default: m.ScreenshotsTab })))

function Loader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 size={32} className="animate-spin text-[#3b82f6]" />
    </div>
  )
}

function App() {
  const {
    isAuthenticated, activeAccount,
    launchingInstanceName, runningInstances,
    showCreateModal, setShowCreateModal,
    versions, instances, selectedInstance, setSelectedInstance,
    launcherDirectory, settings, setSettings,
    activeTab, setActiveTab,
    consoleLogs,
    showInstanceDetails, setShowInstanceDetails,
    creatingInstanceName, setCreatingInstanceName,
    confirmModal, setConfirmModal,
    alertModal, setAlertModal,
    navigationHistory, historyIndex,
    background,
    showSettingsModal, setShowSettingsModal,
    sidebarContextMenu, setSidebarContextMenu,
    updateInfo, isInstallingUpdate,
    showFriendsPanel, setShowFriendsPanel,
    browseSubTab, setBrowseSubTab,
    showAccountDropdown, setShowAccountDropdown,
    accounts, loadAccounts, appWindow,
    dragRegion, noDragRegion,
    navigateBack, navigateForward,
    handleInstallUpdate,
    handleLaunch, handleDeleteInstance, handleDuplicateInstance,
    handleOpenInstanceFolderByInstance,
    handleShowDetails, handleCloseDetails,
    handleStartCreating, handleCreationComplete, handleCreationError,
    handleKillInstance, handleOpenSettings, handleCreateNew,
    handleClearConsole, handleNavigateToInstances, handleLaunchSelected,
    loadInstances, handleInstanceRenamed, loadBackground,
  } = useLauncherState()

  return (
    <div className={`flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans ${settings?.theme ? `theme-${settings.theme}` : 'theme-octane'}`}>

      <TitleBar
        activeTab={activeTab}
        showInstanceDetails={showInstanceDetails}
        selectedInstance={selectedInstance}
        browseSubTab={browseSubTab}
        navigateBack={navigateBack}
        navigateForward={navigateForward}
        historyIndex={historyIndex}
        navigationHistoryLength={navigationHistory.length}
        isAuthenticated={isAuthenticated}
        activeAccount={activeAccount}
        accounts={accounts}
        showAccountDropdown={showAccountDropdown}
        setShowAccountDropdown={setShowAccountDropdown}
        loadAccounts={loadAccounts}
        appWindow={appWindow}
        showFriendsPanel={showFriendsPanel}
        setShowFriendsPanel={setShowFriendsPanel}
        dragRegion={dragRegion}
        noDragRegion={noDragRegion}
      />

      <div className="flex flex-1 overflow-hidden px-4 gap-4">

        <Sidebar
          setActiveTab={setActiveTab}
          setShowInstanceDetails={setShowInstanceDetails}
          activeTab={activeTab}
          sidebarContextMenu={sidebarContextMenu}
          setSidebarContextMenu={setSidebarContextMenu}
          setSelectedInstance={setSelectedInstance}
          onOpenInstanceFolder={handleOpenInstanceFolderByInstance}
          onDuplicateInstance={handleDuplicateInstance}
          onDeleteInstance={handleDeleteInstance}
          updateInfo={updateInfo}
          isInstallingUpdate={isInstallingUpdate}
          onInstallUpdate={handleInstallUpdate}
          onOpenSettings={handleOpenSettings}
          onCreateNew={handleCreateNew}
        />

        <div
          className="flex-1 rounded-xl overflow-hidden flex flex-col relative"
          style={
            background
              ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { backgroundColor: 'var(--content-bg)' }
          }
        >
          {background && <div className="absolute inset-0 bg-black/80" />}

          <main className="flex-1 min-h-0 overflow-y-auto relative z-10">
            {showInstanceDetails && selectedInstance ? (
              <InstanceDetailsTab
                instance={selectedInstance}
                isAuthenticated={isAuthenticated}
                isLaunching={launchingInstanceName === selectedInstance.name}
                isRunning={runningInstances.has(selectedInstance.name)}
                onLaunch={handleLaunchSelected}
                onBack={handleCloseDetails}
                onInstanceUpdated={loadInstances}
                onInstanceRenamed={handleInstanceRenamed}
              />
            ) : (
              <>
                {activeTab === "home" && (
                  <Suspense fallback={<Loader />}>
                    <HomeTab
                      instances={instances}
                      isAuthenticated={isAuthenticated}
                      activeAccount={activeAccount}
                      launchingInstanceName={launchingInstanceName}
                      runningInstances={runningInstances}
                      onLaunch={handleLaunch}
                      onDeleteInstance={handleDeleteInstance}
                      onShowDetails={handleShowDetails}
                      onOpenFolderByInstance={handleOpenInstanceFolderByInstance}
                      onDuplicateInstance={handleDuplicateInstance}
                      onKillInstance={handleKillInstance}
                      onNavigateToInstances={handleNavigateToInstances}
                    />
                  </Suspense>
                )}
                {activeTab === "instances" && (
                  <Suspense fallback={<Loader />}>
                    <InstancesTab
                      instances={instances}
                      isAuthenticated={isAuthenticated}
                      launchingInstanceName={launchingInstanceName}
                      runningInstances={runningInstances}
                      onSetSelectedInstance={setSelectedInstance}
                      onLaunch={handleLaunch}
                      onCreateNew={handleCreateNew}
                      onShowDetails={handleShowDetails}
                      onOpenFolder={handleOpenInstanceFolderByInstance}
                      onDuplicateInstance={handleDuplicateInstance}
                      onDeleteInstance={handleDeleteInstance}
                      onKillInstance={handleKillInstance}
                    />
                  </Suspense>
                )}
                {activeTab === "browse" && (
                  <Suspense fallback={<Loader />}>
                    <BrowseTab
                      selectedInstance={selectedInstance}
                      instances={instances}
                      onSetSelectedInstance={setSelectedInstance}
                      onRefreshInstances={loadInstances}
                      onShowCreationToast={handleStartCreating}
                      activeSubTab={browseSubTab}
                      onSubTabChange={setBrowseSubTab}
                    />
                  </Suspense>
                )}
                {activeTab === "servers" && (
                  <Suspense fallback={<Loader />}>
                    <ServersTab runningInstances={runningInstances} />
                  </Suspense>
                )}
                {activeTab === "skins" && (
                  <Suspense fallback={<Loader />}>
                    <SkinsTab activeAccount={activeAccount} isAuthenticated={isAuthenticated} />
                  </Suspense>
                )}
                {activeTab === "screenshots" && (
                  <Suspense fallback={<Loader />}>
                    <ScreenshotsTab />
                  </Suspense>
                )}
                {activeTab === "console" && (
                  <Suspense fallback={<Loader />}>
                    <ConsoleTab
                      consoleLogs={consoleLogs}
                      onClearConsole={handleClearConsole}
                    />
                  </Suspense>
                )}
              </>
            )}
          </main>

          {creatingInstanceName && (
            <div className="absolute bottom-0 left-0 right-0 z-20">
              <CreationProgressToast
                instanceName={creatingInstanceName}
                onError={handleCreationError}
                onDismiss={() => setCreatingInstanceName(null)}
              />
            </div>
          )}
        </div>

        <FriendsPanel
          isOpen={showFriendsPanel}
          isAuthenticated={isAuthenticated}
          activeAccountUuid={activeAccount?.uuid}
        />
      </div>

      <div className="flex flex-shrink-0 px-4 pb-4">
        <div className="w-14 flex-shrink-0" />
        <div className="flex-1 h-0" />
      </div>

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.type === "danger" ? "Delete" : "Confirm"}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          checkboxLabel={confirmModal.checkboxLabel}
          checkboxChecked={confirmModal.checkboxChecked}
          onCheckboxChange={confirmModal.onCheckboxChange}
        />
      )}

      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        settings={settings}
        launcherDirectory={launcherDirectory}
        onClose={() => setShowSettingsModal(false)}
        onSettingsChange={setSettings}
        onBackgroundChanged={loadBackground}
      />

      {showCreateModal && (
        <CreateInstanceModal
          versions={versions}
          instances={instances}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreationComplete}
          onStartCreating={handleStartCreating}
        />
      )}
    </div>
  )
}

export default App