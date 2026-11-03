import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useGroups } from '@renderer/hooks/use-groups'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoProxyDelay,
  runAutoSelectProxy,
  getServerMetrics,
  ServerMetricItem
} from '@renderer/utils/ipc'
import { includesIgnoreCase } from '@renderer/utils/includes'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import {
  ChevronsRight,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Search,
  ArrowUpDown
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { motion, AnimatePresence } from 'motion/react'

function getProviderName(proxy: ControllerProxiesDetail | ControllerGroupDetail): string | undefined {
  return 'provider-name' in proxy ? proxy['provider-name'] : undefined
}

const Proxies: React.FC = () => {
  const { t } = useTranslation()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups = [], mutate } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    autoCloseConnection = true,
    delayTestConcurrency = 50,
    proxyDisplayOrder = 'delay'
  } = appConfig || {}

  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [isAutoSelecting, setIsAutoSelecting] = useState(false)
  const [isTestingGroup, setIsTestingGroup] = useState(false)
  const [sortByDelay, setSortByDelay] = useState(true)

  // Reliability metrics map from backend
  const [serverMetrics, setServerMetrics] = useState<Record<string, ServerMetricItem>>({})

  // Optimistic UI state for active proxy selection
  const [optimisticSelection, setOptimisticSelection] = useState<{ group: string; proxy: string } | null>(null)

  const delayingProxiesRef = useRef<Set<string>>(new Set())
  const [delayingTick, setDelayingTick] = useState(0)

  // Listen for real-time server metrics updates and watchdog emergency switches
  useEffect(() => {
    getServerMetrics()
      .then((m) => {
        if (m) setServerMetrics(m)
      })
      .catch(() => {})

    const handleMetricsUpdated = (_e: unknown, metrics: Record<string, ServerMetricItem>): void => {
      if (metrics) setServerMetrics(metrics)
    }

    const handleWatchdogEmergency = (
      _e: unknown,
      data: { group: string; deadServer: string; newServer: string }
    ): void => {
      toast.warning(`Узел ${data.deadServer} недоступен. Сторож переключил на ${data.newServer}`)
      mutate()
    }

    window.electron.ipcRenderer.on('serverMetricsUpdated', handleMetricsUpdated)
    window.electron.ipcRenderer.on('serverWatchdogEmergencySwitch', handleWatchdogEmergency)

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('serverMetricsUpdated')
      window.electron.ipcRenderer.removeAllListeners('serverWatchdogEmergencySwitch')
    }
  }, [mutate])

  // Current active group
  const validIndex = activeGroupIndex < groups.length ? activeGroupIndex : 0
  const currentGroup = groups[validIndex]

  // Optimistic & Immediate Proxy Switch
  const onChangeProxy = useCallback(
    async (groupName: string, proxyName: string): Promise<void> => {
      // 0ms Optimistic selection
      setOptimisticSelection({ group: groupName, proxy: proxyName })
      try {
        await mihomoChangeProxy(groupName, proxyName)
        // Clean drop of dead sockets to prevent stalls
        if (autoCloseConnection) {
          await mihomoCloseAllConnections(groupName).catch(() => {})
        }
        mutate()
      } catch (e) {
        setOptimisticSelection(null)
        toast.error(`${e}`)
      }
    },
    [autoCloseConnection, mutate]
  )

  const onProxyDelay = useCallback(
    async (
      proxy: ControllerProxiesDetail | ControllerGroupDetail,
      url?: string
    ): Promise<ControllerProxiesDelay> => {
      return await mihomoProxyDelay(proxy.name, url, getProviderName(proxy))
    },
    []
  )

  const mutateThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const throttledMutate = useCallback(() => {
    if (mutateThrottleRef.current) return
    mutateThrottleRef.current = setTimeout(() => {
      mutate()
      mutateThrottleRef.current = null
    }, 500)
  }, [mutate])

  // Domino Ping Cascade for all nodes in the active group
  const handlePingAll = useCallback(async () => {
    if (!currentGroup || isTestingGroup) return
    setIsTestingGroup(true)
    const list = currentGroup.all || []

    list.forEach((p) => {
      if (p?.name) delayingProxiesRef.current.add(p.name)
    })
    setDelayingTick((c) => c + 1)

    const runningList: Promise<void>[] = []
    const results: Promise<void>[] = []

    for (const proxy of list) {
      if (!proxy?.name) continue
      const task = onProxyDelay(proxy, currentGroup.testUrl)
        .then(() => {
          delayingProxiesRef.current.delete(proxy.name)
          setDelayingTick((c) => c + 1)
          throttledMutate()
        })
        .catch(() => {
          delayingProxiesRef.current.delete(proxy.name)
          setDelayingTick((c) => c + 1)
          throttledMutate()
        })

      runningList.push(task)
      results.push(task)

      if (runningList.length >= (delayTestConcurrency || 50)) {
        await Promise.race(runningList)
        const idx = runningList.findIndex((t) => t === task)
        if (idx !== -1) runningList.splice(idx, 1)
      }
    }

    await Promise.all(results)
    mutate()
    setIsTestingGroup(false)
    toast.success('Тест задержки всех узлов завершён')
  }, [currentGroup, isTestingGroup, delayTestConcurrency, onProxyDelay, mutate, throttledMutate])

  // Filtered & Smart-Sorted proxies: from lowest delay to highest (Timeouts & untracked at bottom)
  const filteredProxies = useMemo(() => {
    if (!currentGroup?.all) return []
    let list = currentGroup.all.filter((p) => p && includesIgnoreCase(p.name, searchTerm))

    if (sortByDelay || proxyDisplayOrder === 'delay') {
      list = [...list].sort((a, b) => {
        const aHist = a.history && a.history.length > 0 ? a.history[a.history.length - 1].delay : undefined
        const bHist = b.history && b.history.length > 0 ? b.history[b.history.length - 1].delay : undefined

        const aMetric = serverMetrics[a.name]
        const bMetric = serverMetrics[b.name]

        const aDelay = aHist !== undefined ? aHist : (aMetric?.lastDelay ?? aMetric?.emaDelay ?? -1)
        const bDelay = bHist !== undefined ? bHist : (bMetric?.lastDelay ?? bMetric?.emaDelay ?? -1)

        // 1. Untested (-1) and Timeouts (0) go to the very bottom
        const aValid = aDelay > 0
        const bValid = bDelay > 0

        if (aValid && !bValid) return -1
        if (!aValid && bValid) return 1

        if (!aValid && !bValid) {
          // Timeout (0) ranks higher than completely untested (-1)
          if (aDelay === 0 && bDelay === -1) return -1
          if (aDelay === -1 && bDelay === 0) return 1
          return a.name.localeCompare(b.name)
        }

        // 2. Both valid: sort strictly from lowest ping to highest
        if (aDelay !== bDelay) {
          return aDelay - bDelay
        }

        // Tie-breaker: by reliability score
        const aRel = serverMetrics[a.name]?.reliability ?? 50
        const bRel = serverMetrics[b.name]?.reliability ?? 50
        return bRel - aRel
      })
    } else if (proxyDisplayOrder === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [currentGroup, searchTerm, sortByDelay, proxyDisplayOrder, delayingTick, serverMetrics])

  if (mode === 'direct') {
    return (
      <div className="h-full w-full flex justify-center items-center select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-white/5 border border-white/10 p-6">
            <ChevronsRight className="text-muted-foreground text-5xl" />
          </div>
          <h2 className="text-muted-foreground text-lg font-medium">{t('sider.directMode')}</h2>
          <p className="text-xs text-muted-foreground">Прямой режим без проксирования</p>
        </div>
      </div>
    )
  }

  const currentActiveName =
    optimisticSelection?.group === currentGroup?.name ? optimisticSelection.proxy : currentGroup?.now

  return (
    <div className="page-tab-content active-page w-full flex flex-col gap-5 select-none">
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}

      {/* Modern Win11 Section Header Bar (Prompt Motion Polish) */}
      <div className="section-head-bar flex items-center justify-between gap-4 flex-wrap pb-1">
        <div>
          <div className="sec-title text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Управление прокси-группами</span>
            <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              Smart Mesh
            </span>
          </div>
          <div className="sec-desc text-xs text-muted-foreground mt-0.5">
            Сортировка по минимальному пингу, рейтинг стабильности и Watchdog-защита
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <div className="relative flex items-center">
            <Search className="size-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск сервера..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground focus:outline-none focus:border-emerald-500/60 transition-colors w-40 hover:border-white/20"
            />
          </div>

          {/* Toggle lowest ping sort */}
          <button
            onClick={() => setSortByDelay((prev) => !prev)}
            title={sortByDelay ? 'Сортировка: по возрастанию пинга (активна)' : 'Включить сортировку по пингу'}
            className={cn(
              'pm-btn flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-all',
              sortByDelay
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <ArrowUpDown className="size-3.5" />
            <span className="text-[11px]">По пингу</span>
          </button>

          {/* Test Ping button with sonar domino */}
          <button
            onClick={handlePingAll}
            disabled={isTestingGroup}
            className={cn(
              'pm-btn primary flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg cursor-pointer',
              isTestingGroup && 'opacity-80'
            )}
          >
            <Zap className="size-3.5" />
            <span>{isTestingGroup ? 'Тестирование...' : 'Тест пинга'}</span>
          </button>

          {/* Auto-select proxy */}
          <button
            onClick={async () => {
              if (isAutoSelecting) return
              setIsAutoSelecting(true)
              try {
                const res = await runAutoSelectProxy()
                if (res.success) {
                  toast.success('Автовыбор наилучшего узла завершён')
                }
              } catch (e) {
                toast.error(`${e}`)
              } finally {
                setIsAutoSelecting(false)
                mutate()
              }
            }}
            title="Автовыбор сервера с минимальным пингом"
            className="pm-btn flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-emerald-500/40"
          >
            <Sparkles className="size-3.5 text-emerald-400" />
          </button>

          {/* Settings modal */}
          <button
            onClick={() => setIsSettingModalOpen(true)}
            title="Настройки отображения прокси"
            className="pm-btn flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer hover:border-white/30"
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Multiple Groups Tab Pill Bar (if more than 1 group exists) */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {groups.map((group, idx) => {
            const isGroupActive = idx === validIndex
            return (
              <button
                key={group.name}
                onClick={() => setActiveGroupIndex(idx)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border whitespace-nowrap flex items-center gap-2',
                  isGroupActive
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                )}
              >
                <span>{group.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10 opacity-70">
                  {group.all?.length || 0}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 3D Perspective Tilt Card Grid with Smooth Motion Layout Transitions */}
      {filteredProxies.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-white/[0.06] rounded-xl bg-card/20">
          <p className="text-sm text-muted-foreground">Серверы не найдены</p>
        </div>
      ) : (
        <motion.div layout className="servers-grid">
          <AnimatePresence mode="popLayout">
            {filteredProxies.map((proxy) => (
              <motion.div
                key={proxy.name}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  layout: { type: 'spring', damping: 25, stiffness: 220 },
                  opacity: { duration: 0.2 }
                }}
              >
                <ProxyItem
                  mutateProxies={mutate}
                  onProxyDelay={onProxyDelay}
                  onSelect={onChangeProxy}
                  proxy={proxy}
                  group={currentGroup}
                  selected={proxy.name === currentActiveName}
                  isGroupDelaying={delayingProxiesRef.current.has(proxy.name)}
                  reliability={serverMetrics[proxy.name]?.reliability}
                  cachedDelay={serverMetrics[proxy.name]?.lastDelay}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

export default Proxies
