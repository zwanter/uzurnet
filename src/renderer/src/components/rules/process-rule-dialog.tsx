import React, { useState, useEffect, useMemo, memo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { useIconsStore, useProcessIcon, useProcessAppName } from '@renderer/store/icons-store'
import { useConnectionsStore } from '@renderer/store/connections-store'
import { useGroups } from '@renderer/hooks/use-groups'
import { getRunningProcesses, getRuleStr, setRuleStr, mihomoHotReloadConfig } from '@renderer/utils/ipc'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { cn } from '@renderer/lib/utils'
import { toast } from 'sonner'
import yaml from 'js-yaml'
import {
  AppWindow,
  Search,
  CheckCircle2,
  Globe,
  ShieldAlert,
  Zap,
  ArrowUpToLine,
  ArrowDownToLine,
  Activity
} from 'lucide-react'

export interface ProcessItemData {
  processName: string
  processPath: string
  activeCount: number
}

interface ProcessRowProps {
  item: ProcessItemData
  isSelected: boolean
  onSelect: (item: ProcessItemData) => void
}

const ProcessRow: React.FC<ProcessRowProps> = memo(({ item, isSelected, onSelect }) => {
  const iconUrl = useProcessIcon(item.processPath, true)
  const appName = useProcessAppName(item.processPath, true)
  const displayName = appName || item.processName

  return (
    <div
      onClick={() => onSelect(item)}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all border',
        isSelected
          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-sm'
          : 'border-white/[0.06] bg-card/40 hover:bg-card/70 hover:border-white/15'
      )}
    >
      <div className="size-9 shrink-0 flex items-center justify-center rounded-lg bg-black/20 overflow-hidden">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={displayName}
            className="size-7 object-contain drop-shadow"
            loading="lazy"
          />
        ) : (
          <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs text-foreground truncate" title={displayName}>
            {displayName}
          </span>
          {item.activeCount > 0 && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              <span className="live-dot size-1 mr-1 animate-pulse" />
              {item.activeCount}
            </Badge>
          )}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground truncate" title={item.processName}>
          {item.processName}
        </div>
      </div>

      {isSelected && (
        <CheckCircle2 className="size-4 text-emerald-400 shrink-0 ml-1" />
      )}
    </div>
  )
})
ProcessRow.displayName = 'ProcessRow'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId?: string
  proxyGroups?: string[]
  onRuleCreated?: (rule: {
    type: string
    payload: string
    proxy: string
    position: 'prepend' | 'append'
  }) => void
}

export const ProcessRuleDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  profileId,
  proxyGroups = [],
  onRuleCreated
}) => {
  const { groups = [] } = useGroups()
  const [searchTerm, setSearchTerm] = useState('')
  const [processes, setProcesses] = useState<ProcessItemData[]>([])
  const [selectedProcess, setSelectedProcess] = useState<ProcessItemData | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string>('DIRECT')
  const [position, setPosition] = useState<'prepend' | 'append'>('prepend')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  // Determine primary proxy group name (first group or PROXY or GLOBAL)
  const primaryProxyName = useMemo(() => {
    if (proxyGroups.includes('PROXY')) return 'PROXY'
    if (groups.length > 0 && groups[0]?.name) return groups[0].name
    const firstCustom = proxyGroups.find((g) => !['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE'].includes(g))
    return firstCustom || 'PROXY'
  }, [proxyGroups, groups])

  // Load and refresh processes when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedProcess(null)
      setSearchTerm('')
      return
    }

    let isMounted = true
    setLoading(true)

    const fetchProcesses = async (): Promise<void> => {
      const activeConns = useConnectionsStore.getState().active || []
      const closedConns = useConnectionsStore.getState().closed || []
      const connCountMap = new Map<string, number>()

      activeConns.forEach((c) => {
        const proc = c.metadata.process || ''
        if (proc) {
          const key = proc.toLowerCase()
          connCountMap.set(key, (connCountMap.get(key) || 0) + 1)
        }
      })

      const map = new Map<string, ProcessItemData>()

      // 1. Add processes from connections
      ;[...activeConns, ...closedConns].forEach((c) => {
        const proc = c.metadata.process || ''
        const path = c.metadata.processPath || c.metadata.process || ''
        if (proc && !map.has(proc.toLowerCase())) {
          map.set(proc.toLowerCase(), {
            processName: proc,
            processPath: path,
            activeCount: connCountMap.get(proc.toLowerCase()) || 0
          })
          if (path) {
            useIconsStore.getState().requestIcon(path)
            useIconsStore.getState().requestAppName(path)
          }
        }
      })

      // 2. Add running processes from backend IPC
      try {
        const sysProcs = await getRunningProcesses()
        if (Array.isArray(sysProcs)) {
          sysProcs.forEach((p) => {
            if (p && p.processName) {
              const key = p.processName.toLowerCase()
              const existing = map.get(key)
              if (!existing) {
                map.set(key, {
                  processName: p.processName,
                  processPath: p.processPath,
                  activeCount: connCountMap.get(key) || 0
                })
              } else if (!existing.processPath && p.processPath) {
                existing.processPath = p.processPath
              }
              if (p.processPath) {
                useIconsStore.getState().requestIcon(p.processPath)
                useIconsStore.getState().requestAppName(p.processPath)
              }
            }
          })
        }
      } catch {
        // ignore IPC errors
      }

      if (isMounted) {
        const list = Array.from(map.values())
        // Sort: active connections first, then alphabetically
        list.sort((a, b) => {
          if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount
          return a.processName.localeCompare(b.processName)
        })
        setProcesses(list)
        setLoading(false)
      }
    }

    void fetchProcesses()

    return () => {
      isMounted = false
    }
  }, [open])

  // Filtered process list
  const filteredProcesses = useMemo(() => {
    if (!searchTerm.trim()) return processes
    const appNames = useIconsStore.getState().appNames || {}
    return processes.filter((p) => {
      const appName = appNames[p.processPath] || ''
      return (
        includesIgnoreCase(p.processName, searchTerm) ||
        includesIgnoreCase(appName, searchTerm)
      )
    })
  }, [processes, searchTerm])

  // Handle rule creation
  const handleCreateRule = async (): Promise<void> => {
    if (!selectedProcess) {
      toast.warning('Выберите приложение из списка')
      return
    }

    setIsSubmitting(true)
    try {
      if (onRuleCreated) {
        onRuleCreated({
          type: 'PROCESS-NAME',
          payload: selectedProcess.processName,
          proxy: selectedTarget,
          position
        })
        onOpenChange(false)
        return
      }

      if (!profileId) {
        toast.error('Профиль не выбран')
        return
      }

      // Standalone mode from rules page: persist to overrides and hot-reload
      const ruleContent = await getRuleStr(profileId)
      let overrides: any = {}
      try {
        overrides = yaml.load(ruleContent) || {}
      } catch {
        overrides = {}
      }

      const ruleStr = `PROCESS-NAME,${selectedProcess.processName},${selectedTarget}`
      const matchPrefix = `PROCESS-NAME,${selectedProcess.processName},`

      if (position === 'prepend') {
        const currentList = Array.isArray(overrides.prepend) ? overrides.prepend : []
        const filtered = currentList.filter((r: string) => typeof r === 'string' && !r.startsWith(matchPrefix))
        overrides.prepend = [ruleStr, ...filtered]
      } else {
        const currentList = Array.isArray(overrides.append) ? overrides.append : []
        const filtered = currentList.filter((r: string) => typeof r === 'string' && !r.startsWith(matchPrefix))
        overrides.append = [...filtered, ruleStr]
      }

      await setRuleStr(profileId, yaml.dump(overrides))
      await mihomoHotReloadConfig()
      toast.success(`Правило для ${selectedProcess.processName} (${selectedTarget}) успешно применено!`)
      onOpenChange(false)
    } catch (e) {
      toast.error(`Ошибка при создании правила: ${e}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 gap-4 bg-card/95 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <AppWindow className="size-5 text-primary" />
            <span>Правило для запущенного приложения</span>
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск приложения (например: chrome, telegram, discord)..."
            className="pl-9 h-9 text-xs"
            autoFocus
          />
        </div>

        {/* Process list */}
        <div className="h-56 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0 border border-white/[0.06] rounded-xl p-2 bg-black/20">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground gap-2">
              <span className="live-dot size-2 animate-pulse" />
              <span>Сканирование запущенных процессов...</span>
            </div>
          ) : filteredProcesses.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-1 p-4 text-center">
              <Activity className="size-8 opacity-30 mb-1" />
              <span>Приложения не найдены</span>
              <span className="text-[11px] opacity-60">Убедитесь, что приложение запущено или начните вводить его имя</span>
            </div>
          ) : (
            filteredProcesses.map((proc) => (
              <ProcessRow
                key={proc.processName}
                item={proc}
                isSelected={selectedProcess?.processName === proc.processName}
                onSelect={(item) => setSelectedProcess(item)}
              />
            ))
          )}
        </div>

        {/* Rule configuration controls */}
        {selectedProcess && (
          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Выбранный процесс:</span>
              <span className="font-mono font-semibold text-foreground text-[13px]">
                {selectedProcess.processName}
              </span>
            </div>

            {/* Target route selection */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Маршрутизация (куда направить):</span>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={selectedTarget === 'DIRECT' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-8 text-xs font-medium gap-1.5 justify-center',
                    selectedTarget === 'DIRECT' && 'bg-blue-600 hover:bg-blue-500 text-white'
                  )}
                  onClick={() => setSelectedTarget('DIRECT')}
                >
                  <Globe className="size-3.5" />
                  <span>DIRECT</span>
                </Button>

                <Button
                  type="button"
                  variant={selectedTarget === primaryProxyName ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-8 text-xs font-medium gap-1.5 justify-center',
                    selectedTarget === primaryProxyName && 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  )}
                  onClick={() => setSelectedTarget(primaryProxyName)}
                >
                  <Zap className="size-3.5" />
                  <span className="truncate">{primaryProxyName}</span>
                </Button>

                <Button
                  type="button"
                  variant={selectedTarget === 'REJECT' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-8 text-xs font-medium gap-1.5 justify-center',
                    selectedTarget === 'REJECT' && 'bg-rose-600 hover:bg-rose-500 text-white'
                  )}
                  onClick={() => setSelectedTarget('REJECT')}
                >
                  <ShieldAlert className="size-3.5" />
                  <span>REJECT</span>
                </Button>
              </div>
            </div>

            {/* Rule position */}
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-xs">
              <span className="text-muted-foreground">Приоритет:</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant={position === 'prepend' ? 'secondary' : 'ghost'}
                  onClick={() => setPosition('prepend')}
                  className={cn('text-[11px] gap-1', position === 'prepend' && 'font-semibold text-primary')}
                >
                  <ArrowUpToLine className="size-3" />
                  <span>В начало (Приоритет)</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={position === 'append' ? 'secondary' : 'ghost'}
                  onClick={() => setPosition('append')}
                  className={cn('text-[11px] gap-1', position === 'append' && 'font-semibold text-primary')}
                >
                  <ArrowDownToLine className="size-3" />
                  <span>В конец</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCreateRule}
            disabled={!selectedProcess || isSubmitting}
            className="gap-1.5 min-w-32 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <CheckCircle2 className="size-4" />
            <span>Добавить правило</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProcessRuleDialog
