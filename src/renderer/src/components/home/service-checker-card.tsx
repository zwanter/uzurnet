import React, { useState, useEffect } from 'react'
import {
  Radio,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Globe
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { toast } from 'sonner'
import {
  checkZapretServices,
  checkCustomEndpoints,
  ZapretServiceCheckResult,
  CustomServiceEndpoint,
  CustomServiceCheckResult
} from '@renderer/utils/ipc'
import { cn } from '@renderer/lib/utils'

const STORAGE_KEY = 'uzurnet_custom_services'

const DEFAULT_CUSTOM_SERVICES: CustomServiceEndpoint[] = [
  { id: 'tg', name: 'Telegram Web', url: 'https://web.telegram.org' },
  { id: 'insta', name: 'Instagram', url: 'https://www.instagram.com' }
]

export const ServiceCheckerCard: React.FC = () => {
  const [customServices, setCustomServices] = useState<CustomServiceEndpoint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_CUSTOM_SERVICES
  })

  const [checking, setChecking] = useState(false)
  const [zapretResults, setZapretResults] = useState<ZapretServiceCheckResult | null>(null)
  const [customResults, setCustomResults] = useState<Record<string, CustomServiceCheckResult>>({})

  // Add custom service modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customServices))
    } catch {}
  }, [customServices])

  const handleAddService = (): void => {
    const trimmedName = newName.trim()
    let trimmedUrl = newUrl.trim()

    if (!trimmedName) {
      toast.error('Введите название сервиса')
      return
    }
    if (!trimmedUrl) {
      toast.error('Введите адрес сервиса (URL)')
      return
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      trimmedUrl = `https://${trimmedUrl}`
    }

    const newEndpoint: CustomServiceEndpoint = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      url: trimmedUrl
    }

    setCustomServices((prev) => [...prev, newEndpoint])
    setNewName('')
    setNewUrl('')
    setShowAddModal(false)
    toast.success(`Сервис «${trimmedName}» добавлен`)
  }

  const handleDeleteService = (id: string, name: string): void => {
    setCustomServices((prev) => prev.filter((s) => s.id !== id))
    setCustomResults((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    toast.info(`Сервис «${name}» удалён`)
  }

  const handleCheckAll = async (): Promise<void> => {
    setChecking(true)
    try {
      const [zapRes, custRes] = await Promise.allSettled([
        checkZapretServices(),
        customServices.length > 0 ? checkCustomEndpoints(customServices, 4000) : Promise.resolve([])
      ])

      let successCount = 0
      let totalCount = 2 + customServices.length

      if (zapRes.status === 'fulfilled') {
        setZapretResults(zapRes.value)
        if (zapRes.value.youtube) successCount++
        if (zapRes.value.discord) successCount++
      }

      if (custRes.status === 'fulfilled') {
        const resultMap: Record<string, CustomServiceCheckResult> = {}
        for (const item of custRes.value) {
          resultMap[item.id] = item
          if (item.ok) successCount++
        }
        setCustomResults(resultMap)
      }

      if (successCount === totalCount) {
        toast.success(`Все сервисы доступны (${successCount}/${totalCount})!`)
      } else if (successCount > 0) {
        toast.info(`Доступно ${successCount} из ${totalCount} сервисов`)
      } else {
        toast.error('Сервисы недоступны. Проверьте подключение VPN или смените стратегию Zapret.')
      }
    } catch (e) {
      toast.error(`Ошибка проверки: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 dark:border-white/5 bg-card/70 dark:bg-card/40 p-5 backdrop-blur-md space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-foreground">Проверка доступности сервисов</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Прямое тестирование доступности без пинга (проверяет реальный пропуск трафика через VPN или Zapret DPI).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddModal(true)}
            className="text-xs h-8 px-2.5 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </Button>

          <Button
            size="sm"
            onClick={handleCheckAll}
            disabled={checking}
            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border text-xs h-8 px-3 shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', checking && 'animate-spin')} />
            <span>{checking ? 'Проверка...' : 'Проверить доступность'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        {/* YouTube Card */}
        <div className="p-3.5 rounded-xl border border-border/60 dark:border-white/5 bg-muted/40 dark:bg-black/30 space-y-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              YouTube
            </span>
            {zapretResults ? (
              zapretResults.youtube ? (
                <Badge className="bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] py-0 px-2">
                  Доступен
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px] py-0 px-2">
                  Заблокирован
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-border/60 text-[11px] py-0 px-2">
                Не проверялся
              </Badge>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center text-foreground/80 dark:text-zinc-400">
              <span className="truncate pr-1">Веб (youtube.com):</span>
              {zapretResults ? (
                zapretResults.details.youtubeWeb ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
            <div className="flex justify-between items-center text-foreground/80 dark:text-zinc-400">
              <span className="truncate pr-1">Видео (googlevideo):</span>
              {zapretResults ? (
                zapretResults.details.youtubeVideo ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Discord Card */}
        <div className="p-3.5 rounded-xl border border-border/60 dark:border-white/5 bg-muted/40 dark:bg-black/30 space-y-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Discord
            </span>
            {zapretResults ? (
              zapretResults.discord ? (
                <Badge className="bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] py-0 px-2">
                  Доступен
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px] py-0 px-2">
                  Заблокирован
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-border/60 text-[11px] py-0 px-2">
                Не проверялся
              </Badge>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center text-foreground/80 dark:text-zinc-400">
              <span className="truncate pr-1">Веб (discord.com):</span>
              {zapretResults ? (
                zapretResults.details.discordWeb ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
            <div className="flex justify-between items-center text-foreground/80 dark:text-zinc-400">
              <span className="truncate pr-1">Шлюз (gateway.discord.gg):</span>
              {zapretResults ? (
                zapretResults.details.discordGateway ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Custom Services Cards */}
        {customServices.map((svc) => {
          const res = customResults[svc.id]
          return (
            <div
              key={svc.id}
              className="p-3.5 rounded-xl border border-border/60 dark:border-white/5 bg-muted/40 dark:bg-black/30 space-y-2.5 flex flex-col justify-between group relative"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-foreground truncate max-w-36" title={svc.name}>
                  {svc.name}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {res ? (
                    res.ok ? (
                      <Badge className="bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] py-0 px-2">
                        {res.latencyMs ? `${res.latencyMs} мс` : 'Доступен'}
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/15 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px] py-0 px-2">
                        Недоступен
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/60 text-[11px] py-0 px-2">
                      Не проверялся
                    </Badge>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteService(svc.id, svc.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-rose-400 cursor-pointer"
                    title="Удалить сервис"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-foreground/80 dark:text-zinc-400 pt-1">
                <span className="truncate text-[11px] font-mono text-muted-foreground max-w-44" title={svc.url}>
                  {svc.url.replace(/^https?:\/\//, '')}
                </span>

                {res ? (
                  res.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  )
                ) : (
                  <Globe className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Custom Service Modal */}
      {showAddModal && (
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                <span>Добавить сервис для проверки</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Название сервиса</label>
                <Input
                  placeholder="Например: Telegram, Twitter, Twitch, OpenAI..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">URL / Адрес сайта</label>
                <Input
                  placeholder="https://example.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="h-9 text-sm font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddService()
                  }}
                />
              </div>
            </div>

            <DialogFooter className="sm:justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}>
                Отмена
              </Button>
              <Button size="sm" onClick={handleAddService} className="bg-primary text-primary-foreground font-semibold">
                Добавить сервис
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
