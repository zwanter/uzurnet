import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import React, { useEffect, useRef, useState } from 'react'
import { NavigateFunction, useNavigate, useRoutes } from 'react-router-dom'
import './i18n'
import { useTranslation } from 'react-i18next'
import routes from '@renderer/routes'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  applyTheme,
  checkIsAdmin,
  checkUpdate,
  getAppConfig,
  getVersion,
  needsFirstRunAdmin,
  restartAsAdmin,
  setNativeTheme
} from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import useSWR from 'swr'
import ConfirmModal from '@renderer/components/base/base-confirm'
import AppSidebar from '@renderer/components/app-sidebar'
import UpdateBanner from '@renderer/components/updater/update-banner'
import HwidLimitAlert from '@renderer/components/profiles/hwid-limit-alert'
import CoreErrorAlert from '@renderer/components/mihomo/core-error-alert'
import WindowControls from '@renderer/components/window-controls'
import UzurNetLogo from '@renderer/components/common/uzurnet-logo'
import { attachConnectionsStore } from '@renderer/store/connections-store'
import { attachTrafficStore } from '@renderer/store/traffic-store'
import { attachLogsStore } from '@renderer/store/logs-store'
import { attachUpdaterStore } from '@renderer/store/updater-store'
import { attachCoreLifecycleStore } from '@renderer/store/core-lifecycle-store'

let navigate: NavigateFunction

const App: React.FC = () => {
  const { t } = useTranslation()
  const { appConfig } = useAppConfig()
  const {
    appTheme = 'system',
    customTheme,
    autoCheckUpdate
  } = appConfig || {}
  const { setTheme, systemTheme, resolvedTheme } = useTheme()
  navigate = useNavigate()
  const page = useRoutes(routes)
  const { data: latest } = useSWR(
    autoCheckUpdate ? ['checkUpdate'] : undefined,
    autoCheckUpdate ? checkUpdate : (): undefined => {},
    {
      refreshInterval: 1000 * 60 * 10
    }
  )

  const [appVer, setAppVer] = useState('')
  useEffect(() => {
    getVersion().then((v) => setAppVer(v)).catch(() => {})
  }, [])

  useEffect(() => {
    const detachConnections = attachConnectionsStore()
    const detachTraffic = attachTrafficStore()
    const detachLogs = attachLogsStore()
    const detachUpdater = attachUpdaterStore()
    const detachCoreLifecycle = attachCoreLifecycleStore()
    return (): void => {
      detachConnections()
      detachTraffic()
      detachLogs()
      detachUpdater()
      detachCoreLifecycle()
    }
  }, [])

  useEffect(() => {
    const tourShown = window.localStorage.getItem('tourShown')
    if (!tourShown) {
      import('@renderer/utils/driver').then(({ startTour }) => {
        startTour(navigate, {
          onMainGuideCompleted: (): void => {
            window.localStorage.setItem('tourShown', 'true')
          }
        })
      })
    }
  }, [])

  useEffect(() => {
    setNativeTheme(appTheme)
    setTheme(appTheme)
  }, [appTheme, systemTheme])

  useEffect(() => {
    applyTheme(customTheme || 'default.css')
  }, [customTheme])

  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showProfileInstallConfirm, setShowProfileInstallConfirm] = useState(false)
  const [showAdminRequired, setShowAdminRequired] = useState(false)
  const profileInstallConfirmedRef = useRef(false)
  const [profileInstallData, setProfileInstallData] = useState<{
    url: string
    name?: string | null
  }>()

  useEffect(() => {
    const handleShowQuitConfirm = (): void => {
      setShowQuitConfirm(true)
    }
    const handleShowProfileInstallConfirm = (
      _event: unknown,
      data: { url: string; name?: string | null }
    ): void => {
      profileInstallConfirmedRef.current = false
      setProfileInstallData(data)
      setShowProfileInstallConfirm(true)
    }

    window.electron.ipcRenderer.on('show-quit-confirm', handleShowQuitConfirm)
    window.electron.ipcRenderer.on('show-profile-install-confirm', handleShowProfileInstallConfirm)

    const handleShowError = (_event: unknown, title: string, message: string): void => {
      toast.error(title, { description: message })
    }
    window.electron.ipcRenderer.on('showError', handleShowError)

    const handleNeedsAdminSetup = (): void => {
      setShowAdminRequired(true)
    }
    window.electron.ipcRenderer.on('needs-admin-setup', handleNeedsAdminSetup)

    const handleAutoSelectCompleted = async (
      _event: unknown,
      data: {
        manual: boolean
        notify?: boolean
        results: { group: string; switched: boolean; current: string; delay: number }[]
      }
    ): Promise<void> => {
      if (!data || !data.results || data.manual) return
      if (data.notify === false) return

      // Double check latest config to prevent stale closure notifications
      const latestCfg = await getAppConfig().catch(() => null)
      if (latestCfg && latestCfg.autoSelectNotify === false) return

      const switched = data.results.filter((r) => r.switched)
      if (switched.length > 0) {
        switched.forEach((r) => {
          toast.success(
            t('autoSelect.switchedToast', {
              group: r.group,
              proxy: r.current,
              delay: r.delay,
              defaultValue: `Автовыбор [${r.group}]: переключено на ${r.current} (${r.delay} мс)`
            })
          )
        })
      }
    }
    window.electron.ipcRenderer.on('autoSelectCompleted', handleAutoSelectCompleted)

    if (platform === 'win32') {
      checkIsAdmin()
        .then((isAdmin) => {
          if (!isAdmin) {
            setShowAdminRequired(true)
          }
        })
        .catch(() => {
          needsFirstRunAdmin().then((needs) => {
            if (needs) setShowAdminRequired(true)
          })
        })
    }

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('show-quit-confirm')
      window.electron.ipcRenderer.removeAllListeners('show-profile-install-confirm')
      window.electron.ipcRenderer.removeAllListeners('needs-admin-setup')
      window.electron.ipcRenderer.removeAllListeners('autoSelectCompleted')
      window.electron.ipcRenderer.removeAllListeners('showError')
    }
  }, [])

  const handleQuitConfirm = (confirmed: boolean): void => {
    setShowQuitConfirm(false)
    window.electron.ipcRenderer.send('quit-confirm-result', confirmed)
  }

  const handleProfileInstallConfirm = (confirmed: boolean): void => {
    setShowProfileInstallConfirm(false)
    window.electron.ipcRenderer.send('profile-install-confirm-result', confirmed)
  }

  return (
    <div
      className="app-window w-screen h-screen flex flex-col overflow-hidden select-none"
      style={{
        background:
          resolvedTheme === 'dark'
            ? 'radial-gradient(140% 120% at 50% -10%, #0c101c 0%, #05070b 60%, #020305 100%)'
            : 'radial-gradient(140% 120% at 50% -10%, #eef2f9 0%, #e2e8f0 60%, #cbd5e1 100%)'
      }}
    >
      <div className="ambient-aurora pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>

      {showQuitConfirm && (
        <ConfirmModal
          title={t('modal.confirmQuit')}
          description={
            <div>
              <p></p>
              <p className="text-sm text-gray-500 mt-2">{t('modal.quitWarning')}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t('modal.quickQuitHint')} {platform === 'darwin' ? '⌘Q' : 'Ctrl+Q'}{' '}
                {t('modal.canQuitDirectly')}
              </p>
            </div>
          }
          confirmText={t('common.quit')}
          cancelText={t('common.cancel')}
          onChange={(open) => {
            if (!open) {
              handleQuitConfirm(false)
            }
          }}
          onConfirm={() => handleQuitConfirm(true)}
        />
      )}
      {showProfileInstallConfirm && profileInstallData && (
        <ConfirmModal
          title={t('modal.confirmImportProfile')}
          description={
            <div className="max-w-md">
              <p className="text-sm text-gray-600 mb-2">
                {t('modal.nameLabel')}
                {profileInstallData.name || t('common.unnamed')}
              </p>
              <p className="text-sm text-gray-600 mb-2 truncate">
                {t('modal.linkLabel')}
                {profileInstallData.url}
              </p>
              <p className="text-sm text-orange-500 mt-2 text-balance">
                {t('modal.ensureTrustedSource')}
              </p>
            </div>
          }
          confirmText={t('common.import')}
          cancelText={t('common.cancel')}
          onChange={(open) => {
            if (!open) {
              handleProfileInstallConfirm(profileInstallConfirmedRef.current)
              profileInstallConfirmedRef.current = false
            }
          }}
          onConfirm={() => {
            profileInstallConfirmedRef.current = true
          }}
          className="min-w-lg guide-profile-install-modal"
        />
      )}
      {showAdminRequired && (
        <ConfirmModal
          preventClose={true}
          showCloseButton={false}
          title={t('modal.adminRequired', 'Требуются права администратора')}
          description={
            <div className="space-y-2 py-1 text-left">
              <p className="text-sm text-foreground/90 font-medium">
                {t(
                  'modal.adminRequiredDesc',
                  'Для работы приложения, сетевого TUN-драйвера и обхода блокировок Zapret DPI необходим запуск от имени администратора.'
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Пожалуйста, нажмите кнопку ниже, чтобы перезапустить приложение с правами администратора.
              </p>
            </div>
          }
          confirmText={t('modal.restartAsAdmin', 'Перезапустить от имени администратора')}
          onChange={() => {
            // Cannot be closed
          }}
          onConfirm={async () => {
            try {
              await restartAsAdmin()
            } catch (err) {
              toast.error(`Ошибка перезапуска: ${err instanceof Error ? err.message : String(err)}`)
            }
          }}
          className="guide-admin-required-modal border-rose-500/30"
        />
      )}
      <HwidLimitAlert />
      <CoreErrorAlert />

      {platform === 'darwin' && (
        <div className="fixed top-0.5 -left-1 h-14.25 flex items-center pl-3 z-100 app-drag">
          <WindowControls />
        </div>
      )}

      {/* Windows 11 Native Acrylic Titlebar */}
      {platform === 'win32' && !appConfig?.useWindowFrame && (
        <header className="titlebar shrink-0 app-drag relative z-50">
          <div className="titlebar-brand">
            <div className="uzurnet-icon flex items-center justify-center">
              <UzurNetLogo className="size-4.5" />
            </div>
            <div className="titlebar-text">
              <span>UzurNet</span>
              <span className="version-tag">{appVer ? `v${appVer}` : 'v1.6.2'}</span>
            </div>
            <div className="status-pill">
              <span className="live-dot" />
              <span>{appConfig?.mainSwitchMode === 'tun' ? 'Режим TUN активен' : 'Режим прокси активен'}</span>
            </div>
          </div>
          <div className="window-controls app-nodrag">
            <WindowControls />
          </div>
        </header>
      )}

      {/* Window Body: Win11 Fluent 220px Sidebar + Content Area */}
      <div className="window-body flex-1 flex min-h-0 relative z-10 w-full overflow-hidden">
        <AppSidebar />
        <main className="content-area flex-1 h-full overflow-y-auto min-w-0 p-6">
          {latest?.version && <UpdateBanner latest={latest} />}
          {page}
        </main>
      </div>
    </div>
  )
}

export default App
