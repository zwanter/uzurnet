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
  checkUpdate,
  declineElevation,
  needsFirstRunAdmin,
  restartAsAdmin,
  setNativeTheme
} from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import useSWR from 'swr'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import AppSidebar from '@renderer/components/app-sidebar'
import UpdateBanner from '@renderer/components/updater/update-banner'
import HwidLimitAlert from '@renderer/components/profiles/hwid-limit-alert'
import CoreErrorAlert from '@renderer/components/mihomo/core-error-alert'
import WindowControls from '@renderer/components/window-controls'
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
  const adminRestartRequestedRef = useRef(false)
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

    const handleAutoSelectCompleted = (
      _event: unknown,
      data: {
        manual: boolean
        results: { group: string; switched: boolean; current: string; delay: number }[]
      }
    ): void => {
      if (data && data.results && !data.manual) {
        const switched = data.results.filter((r) => r.switched)
        if (switched.length > 0 && appConfig?.autoSelectNotify !== false) {
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
    }
    window.electron.ipcRenderer.on('autoSelectCompleted', handleAutoSelectCompleted)

    if (platform === 'win32') {
      needsFirstRunAdmin().then((needs) => {
        if (needs) setShowAdminRequired(true)
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
    <SidebarProvider
      defaultOpen={false}
      className="relative w-full h-screen overflow-hidden"
      style={{
        background:
          resolvedTheme === 'dark'
            ? 'radial-gradient(100% 70% at 50% 0%, rgba(255, 255, 255, 0.035) 0%, transparent 100%), #202020'
            : 'radial-gradient(100% 70% at 50% 0%, #ffffff 0%, transparent 100%), #f3f3f3'
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent z-0" />
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
          title={t('modal.adminRequired')}
          description={
            <div>
              <p className="text-sm">{t('modal.adminRequiredDesc')}</p>
            </div>
          }
          confirmText={t('modal.restartAsAdmin')}
          cancelText={t('modal.continueWithoutAdmin')}
          onChange={(open) => {
            if (!open) {
              setShowAdminRequired(false)
              // Dismissing the dialog means the user declines: remember it so the app stops
              // asking on every launch and falls back to system proxy only.
              if (!adminRestartRequestedRef.current) {
                declineElevation().catch(() => {})
              }
              adminRestartRequestedRef.current = false
            }
          }}
          onConfirm={async () => {
            adminRestartRequestedRef.current = true
            await restartAsAdmin()
          }}
          className="guide-admin-required-modal"
        />
      )}
      <HwidLimitAlert />
      <CoreErrorAlert />
      {platform === 'darwin' && (
        <div className="fixed top-0.5 -left-1 h-14.25 flex items-center pl-3 z-100 app-drag">
          <WindowControls />
        </div>
      )}
      <AppSidebar />
      {latest?.version && <UpdateBanner latest={latest} />}
      <div className="relative z-10 main grow h-full overflow-y-auto">
        {page}
      </div>
    </SidebarProvider>
  )
}

export default App
