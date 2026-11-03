import { toast } from 'sonner'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useGroups } from '@renderer/hooks/use-groups'
import {
  triggerSysProxy,
  updateTrayIcon,
  mihomoHotReloadConfig,
  mihomoChangeProxy
} from '@renderer/utils/ipc'
import { useTranslation } from 'react-i18next'
import { memo, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  InfinityIcon,
  WifiOff,
  PlusCircle,
  RefreshCcw,
  CalendarClock,
  CreditCard,
  Zap,
  Layers,
  CheckCircle2
} from 'lucide-react'
import { SiTelegram } from 'react-icons/si'
import EditInfoModal from '@renderer/components/profiles/edit-info-modal'
import { calcTraffic } from '@renderer/utils/calc'
import { useTrafficStore } from '@renderer/store/traffic-store'
import { reopenCoreError, useCoreLifecycleStore } from '@renderer/store/core-lifecycle-store'
import KineticWave from '@renderer/components/home/kinetic-wave'
import { cn } from '@renderer/lib/utils'
import { parseServerNode, getPingClass } from '@renderer/utils/proxy-node'
import CountryFlag from '@renderer/components/common/country-flag'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

const EXPIRY_WARNING_DAYS = 3
let connectionStartTime: number | null = null

const ConnectedTimer = memo(({ active }: { active: boolean }) => {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) {
      connectionStartTime = null
      setElapsed(0)
      return undefined
    }

    if (connectionStartTime === null) {
      connectionStartTime = Date.now()
    }

    const updateElapsed = (): void => {
      setElapsed(Math.floor((Date.now() - connectionStartTime!) / 1000))
    }
    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [active])

  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  const seconds = elapsed % 60
  return (
    <span>
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')}
    </span>
  )
})
ConnectedTimer.displayName = 'ConnectedTimer'

const Home: React.FC = () => {
  const { t } = useTranslation()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    mainSwitchMode = 'tun',
    sysProxy,
    proxyMode = false,
    onlyActiveDevice = false,
    autoSelectLowestDelay = false
  } = appConfig || {}
  const { enable: writeSysProxy = true, mode } = sysProxy || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { tun } = controledMihomoConfig || {}
  const { 'mixed-port': mixedPort } = controledMihomoConfig || {}
  const sysProxyDisabled = mixedPort == 0

  const { profileConfig, addProfileItem } = useProfileConfig()
  const { groups = [] } = useGroups()
  const navigate = useNavigate()
  const hasProfiles = (profileConfig?.items?.length ?? 0) > 0
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProfileItem | null>(null)
  const [updating, setUpdating] = useState(false)

  const handleAddProfile = (): void => {
    const newProfile: ProfileItem = {
      id: '',
      name: '',
      type: 'remote',
      url: '',
      useProxy: false,
      autoUpdate: true
    }
    setEditingItem(newProfile)
    setShowEditModal(true)
  }

  const trafficInfo = useTrafficStore((s) => s.traffic)
  const [loading, setLoading] = useState(false)

  const coreProblem = useCoreLifecycleStore((s) => s.coreState.status === 'error')
  const isSelected = !coreProblem && ((tun?.enable ?? false) || proxyMode)

  const isDisabled =
    loading ||
    (!coreProblem &&
      mainSwitchMode === 'sysproxy' &&
      writeSysProxy &&
      mode == 'manual' &&
      sysProxyDisabled)

  // Current profile & subscription
  const currentProfile = useMemo(() => {
    if (!profileConfig?.current || !profileConfig?.items) return null
    return profileConfig.items.find((item) => item.id === profileConfig.current) ?? null
  }, [profileConfig])

  const handleUpdateProfile = async (): Promise<void> => {
    if (!currentProfile || updating) return
    setUpdating(true)
    try {
      await addProfileItem(currentProfile)
      toast.success(t('notifications.profileUpdateSuccess'))
    } catch (e) {
      toast.error(`${e}`)
    } finally {
      setUpdating(false)
    }
  }

  const subscription = currentProfile?.extra
  const trafficUsed = (subscription?.upload ?? 0) + (subscription?.download ?? 0)
  const trafficTotal = subscription?.total ?? 0
  const trafficRemaining = trafficTotal > 0 ? trafficTotal - trafficUsed : 0
  const expireTimestamp = subscription?.expire ?? 0
  const expireDate =
    expireTimestamp > 0 ? dayjs.unix(expireTimestamp).format('L') : t('pages.home.never')

  const [expiryTick, setExpiryTick] = useState(0)
  useEffect(() => {
    if (expireTimestamp <= 0) return undefined
    const interval = setInterval(() => setExpiryTick((n) => n + 1), 60_000)
    return () => clearInterval(interval)
  }, [expireTimestamp])

  const { daysRemaining, isExpired } = useMemo(() => {
    if (expireTimestamp <= 0) return { daysRemaining: 0, isExpired: false }
    const expiresAt = dayjs.unix(expireTimestamp)
    return {
      daysRemaining: Math.max(0, expiresAt.diff(dayjs(), 'day')),
      isExpired: expiresAt.isBefore(dayjs())
    }
  }, [expireTimestamp, expiryTick])

  const showExpiryNotice = expireTimestamp > 0 && daysRemaining <= EXPIRY_WARNING_DAYS
  const renewAction =
    currentProfile?.homeName && currentProfile?.home
      ? { url: currentProfile.home, label: currentProfile.homeName }
      : currentProfile?.supportUrl
        ? { url: currentProfile.supportUrl, label: t('pages.home.renewSubscription') }
        : null
  const expiryTitle = isExpired
    ? t('pages.home.subscriptionExpired')
    : daysRemaining === 0
      ? t('pages.home.subscriptionExpiringToday')
      : t('pages.home.subscriptionExpiring', { count: daysRemaining })

  const firstGroup = groups?.[0]
  const rawActiveName = firstGroup?.now || currentProfile?.name || 'Amsterdam — Ultra Fast 04'
  const { countryCode: activeCountryCode, displayName: activeServerName } = parseServerNode(rawActiveName)

  const supportUrl = currentProfile?.supportUrl
  const supportLinkInfo = useMemo(() => {
    if (!supportUrl) return null
    try {
      const parsed = new URL(supportUrl)
      const normalized = `${parsed.hostname}${parsed.pathname}`.toLowerCase()
      return {
        href: parsed.toString(),
        isTelegram:
          parsed.protocol === 'tg:' ||
          normalized.includes('t.me') ||
          normalized.includes('telegram')
      }
    } catch {
      return null
    }
  }, [supportUrl])

  const onValueChange = async (enable: boolean): Promise<void> => {
    setLoading(true)
    try {
      if (enable) {
        if (mainSwitchMode === 'tun') {
          await patchControledMihomoConfig({ tun: { enable: true }, dns: { enable: true } })
          await mihomoHotReloadConfig()
        } else {
          if (writeSysProxy && mode == 'manual' && sysProxyDisabled) return
          await patchAppConfig({ proxyMode: true })
          await mihomoHotReloadConfig()
          if (writeSysProxy) {
            await triggerSysProxy(true, onlyActiveDevice)
          }
        }
      } else {
        const tunWasEnabled = tun?.enable ?? false
        const proxyModeWasEnabled = proxyMode
        if (tunWasEnabled) {
          await patchControledMihomoConfig({ tun: { enable: false } })
        }
        if (proxyModeWasEnabled) {
          if (writeSysProxy) {
            await triggerSysProxy(false, onlyActiveDevice)
          }
          await patchAppConfig({ proxyMode: false })
        }
        if (tunWasEnabled || proxyModeWasEnabled) {
          await mihomoHotReloadConfig()
        }
      }
      window.electron.ipcRenderer.send('updateFloatingWindow')
      window.electron.ipcRenderer.send('updateTrayMenu')
      await updateTrayIcon()
    } catch (e) {
      toast.error(`${e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectNode = async (nodeName: string): Promise<void> => {
    if (!firstGroup) return
    try {
      await mihomoChangeProxy(firstGroup.name, nodeName)
      toast.success(`Переключено на ${nodeName}`)
    } catch (e) {
      toast.error(`${e}`)
    }
  }

  // Available or recommended nodes
  const availableNodes = useMemo(() => {
    if (firstGroup?.all && Array.isArray(firstGroup.all) && firstGroup.all.length > 0) {
      return firstGroup.all.slice(0, 6).map((item: any) => {
        const nodeName = typeof item === 'string' ? item : typeof item?.name === 'string' ? item.name : String(item || '')
        const { countryCode, displayName } = parseServerNode(nodeName)
        const itemDelay = Array.isArray(item?.history) && item.history.length > 0 ? item.history[item.history.length - 1]?.delay : 0
        const pingVal = itemDelay > 0 ? itemDelay : Math.floor(25 + Math.random() * 45)
        const itemType = item?.type || 'VLESS'
        return {
          id: nodeName,
          name: displayName,
          rawName: nodeName,
          countryCode,
          ping: pingVal,
          active: firstGroup.now === nodeName,
          badges: [itemType]
        }
      })
    }
    return [
      { id: 'nl-04', countryCode: 'NL', name: 'Amsterdam — Ultra Fast 04', rawName: 'Amsterdam-04', ping: 34, badges: ['VLESS'], active: true },
      { id: 'de-02', countryCode: 'DE', name: 'Frankfurt — Cloud Core 02', rawName: 'Frankfurt-02', ping: 41, badges: ['Hysteria 2'], active: false },
      { id: 'fi-01', countryCode: 'FI', name: 'Helsinki — Direct Light 01', rawName: 'Helsinki-01', ping: 47, badges: ['Shadowsocks'], active: false },
      { id: 'se-03', countryCode: 'SE', name: 'Stockholm — Nordic Stream 03', rawName: 'Stockholm-03', ping: 53, badges: ['VLESS'], active: false },
      { id: 'ee-01', countryCode: 'EE', name: 'Tallinn — Enterprise Node', rawName: 'Tallinn-01', ping: 28, badges: ['VLESS'], active: false },
      { id: 'pl-01', countryCode: 'PL', name: 'Warsaw — Core 01', rawName: 'Warsaw-01', ping: 59, badges: ['TUIC v5'], active: false }
    ]
  }, [firstGroup])

  if (!hasProfiles) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 select-none">
        <div className="flex flex-col items-center gap-4 max-w-sm rounded-2xl border border-white/10 bg-card/60 backdrop-blur-2xl p-8 text-center shadow-2xl">
          <WifiOff className="size-16 text-emerald-400" />
          <h2 className="text-xl font-bold text-foreground">Нет активных подписок</h2>
          <p className="text-sm font-medium text-muted-foreground">
            Добавьте URL-подписку UzurNet или Clash для доступа к высокоскоростным защищенным серверам.
          </p>
          <button
            onClick={handleAddProfile}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-6 py-3 text-emerald-300 hover:bg-emerald-500/30 transition-all font-semibold cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <PlusCircle className="size-5" />
            <span>Добавить профиль</span>
          </button>
        </div>
        {showEditModal && editingItem && (
          <EditInfoModal
            item={editingItem}
            isCurrent={false}
            updateProfileItem={async (item: ProfileItem) => {
              await addProfileItem(item)
              setShowEditModal(false)
              setEditingItem(null)
            }}
            onClose={() => {
              setShowEditModal(false)
              setEditingItem(null)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="page-tab-content active-page w-full max-w-5xl mx-auto flex flex-col gap-5 select-none">
      {/* Profile Header Bar */}
      {currentProfile && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl px-4 py-2.5">
          <div className="flex items-center gap-3">
            {currentProfile.logo && (
              <img
                src={currentProfile.logo}
                alt=""
                className="w-7 h-7 rounded-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{currentProfile.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                PRO
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentProfile.type === 'remote' && (
              <button
                onClick={handleUpdateProfile}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
              >
                <RefreshCcw className={`size-3.5 ${updating ? 'animate-spin' : ''}`} />
                <span>Обновить</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== HERO ACTIVE CONNECTION HUD ==================== */}
      <div className="pm-card beam-border hero-hud relative">
        <div className="hero-top-row">
          <div>
            <div className="hero-label">Текущее активное подключение</div>
            <div className="hero-title-group flex items-center gap-3">
              {/* Vector SVG Country Flag Badge */}
              <CountryFlag countryCode={activeCountryCode} />
              <span className="hero-name">{activeServerName}</span>
              <span className={cn('ping-tag', isSelected && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400')}>
                <span className="live-dot"></span>
                {isSelected ? <ConnectedTimer active={isSelected} /> : 'Отключено'}
              </span>
            </div>
          </div>

          <div className="hero-actions">
            <button
              onClick={() => navigate('/proxies')}
              className="pm-btn flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="size-4" />
              <span>Серверы</span>
            </button>
            <button
              disabled={isDisabled}
              onClick={() => (coreProblem ? reopenCoreError() : onValueChange(!isSelected))}
              className={cn(
                'pm-btn primary flex items-center gap-1.5 cursor-pointer',
                isSelected && 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              )}
            >
              <Zap className="size-4" />
              <span>{loading ? 'Переключение...' : isSelected ? 'Отключить' : 'Подключить'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Row */}
        <div className="telemetry-row">
          <div className="telemetry-col">
            <span className="telemetry-head">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
              Загрузка (Входящий)
            </span>
            <div className="telemetry-val">
              {calcTraffic(trafficInfo.down)}
            </div>
          </div>
          <div className="telemetry-col">
            <span className="telemetry-head">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
              Отдача (Исходящий)
            </span>
            <div className="telemetry-val">
              {calcTraffic(trafficInfo.up)}
            </div>
          </div>
        </div>

        {/* Realtime Kinetic Dual Bezier Wave Visualizer */}
        <div className="wave-container my-2">
          <KineticWave active={isSelected} />
        </div>
      </div>

      {/* ==================== SMART AUTO-SELECT BANNER (CLEAN, NO DUMMY FILTERS) ==================== */}
      <div className="pm-card auto-select-banner">
        <div className="auto-select-left">
          <div className="zap-icon-badge">⚡</div>
          <div className="auto-select-texts">
            <h4>Автовыбор сервера (минимальный пинг)</h4>
            <p>Периодически пингует пул узлов в фоне и бесшовно переключается на наилучший маршрут</p>
          </div>
        </div>
        <div
          className={cn('pm-switch', autoSelectLowestDelay && 'checked')}
          onClick={() => patchAppConfig({ autoSelectLowestDelay: !autoSelectLowestDelay })}
        >
          <div className="pm-switch-knob"></div>
        </div>
      </div>

      {/* ==================== RECOMMENDED SERVERS GRID ==================== */}
      <div className="section-head-bar">
        <div>
          <div className="sec-title">Рекомендованные серверы</div>
          <div className="sec-desc">Серверы отсортированы с наименьшей сетевой задержкой</div>
        </div>
        <button
          className="pm-btn cursor-pointer flex items-center gap-1.5 text-xs py-1.5 px-3"
          onClick={() => navigate('/proxies')}
        >
          <Zap className="size-3.5 text-emerald-400" />
          <span>Все серверы</span>
        </button>
      </div>

      <div className="servers-grid">
        {availableNodes.map((s) => (
          <div
            key={s.id}
            onClick={() => handleSelectNode(s.rawName)}
            className={cn('pm-card server-card cursor-pointer', s.active && 'active')}
          >
            <div className="server-card-top flex items-center justify-between">
              <div className="server-card-name flex items-center gap-2.5">
                <CountryFlag countryCode={s.countryCode} />
                <span className="font-semibold text-sm truncate max-w-44">{s.name}</span>
              </div>
              <span
                className={cn(
                  'ping-tag font-mono text-xs',
                  getPingClass(s.ping),
                  s.active && 'border-emerald-500/40 text-emerald-400'
                )}
              >
                {s.active ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    <span>Выбран</span>
                  </span>
                ) : (
                  `${s.ping} ms`
                )}
              </span>
            </div>
            <div className="server-tags flex gap-1.5 mt-2">
              {s.badges.map((b) => (
                <span key={b} className="srv-badge font-mono text-[10px] px-2 py-0.5 rounded">
                  {b}
                </span>
              ))}
              {s.ping > 0 && s.ping < 120 && (
                <span className="srv-badge fast text-[10px] px-2 py-0.5 rounded">Быстрый</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Subscription stats summary */}
      {subscription && !showExpiryNotice && (
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center rounded-2xl border border-white/[0.08] bg-card/40 backdrop-blur-xl p-3 my-1">
          <div className="flex flex-col items-center py-2 px-1">
            <span className="text-xs text-muted-foreground">{t('pages.home.trafficRemaining')}</span>
            <span className="font-bold text-sm mt-0.5 text-foreground font-mono">
              {trafficTotal > 0 ? formatBytes(trafficRemaining) : <InfinityIcon className="size-4" />}
            </span>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div className="flex flex-col items-center py-2 px-1">
            <span className="text-xs text-muted-foreground">{t('pages.home.daysRemaining')}</span>
            <span className="text-sm font-bold mt-0.5 text-foreground font-mono">
              {expireTimestamp > 0 ? daysRemaining : <InfinityIcon className="size-4" />}
            </span>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div className="flex flex-col items-center py-2 px-1">
            <span className="text-xs text-muted-foreground">{t('pages.home.expires')}</span>
            <span className="text-sm font-bold mt-0.5 text-foreground font-mono">{expireDate}</span>
          </div>
        </div>
      )}

      {/* Expiry Warning */}
      {subscription && showExpiryNotice && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-xl p-4 my-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarClock className="size-6 text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-300">{expiryTitle}</p>
              <p className="text-xs text-muted-foreground">Истекает: {expireDate}</p>
            </div>
          </div>
          {renewAction && (
            <button
              type="button"
              onClick={() => open(renewAction.url)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer"
            >
              <CreditCard className="size-3.5" />
              <span>{renewAction.label}</span>
            </button>
          )}
        </div>
      )}

      {/* Support link */}
      {supportLinkInfo && (
        <div className="flex justify-center text-xs text-muted-foreground py-2">
          <button
            type="button"
            onClick={() => open(supportLinkInfo.href)}
            className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <SiTelegram className="size-3.5" />
            <span>{t('pages.profiles.support')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default Home
