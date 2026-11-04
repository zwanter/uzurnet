import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Zap,
  Play,
  Square,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Shield,
  Layers,
  FileCode,
  AlertTriangle,
  Radio,
  Sparkles
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Progress } from '@renderer/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  getZapretStatus,
  checkZapretRelease,
  downloadAndInstallZapret,
  startZapret,
  stopZapret,
  checkZapretServices,
  applyZapretHosts,
  removeZapretHosts,
  autoSelectZapretStrategy,
  ZapretStatus,
  ZapretServiceCheckResult,
  ZapretReleaseInfo
} from '@renderer/utils/ipc'

const ZapretPage: React.FC = () => {
  const [status, setStatus] = useState<ZapretStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [operating, setOperating] = useState<boolean>(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [downloadStatusText, setDownloadStatusText] = useState<string>('')
  const [selectedStrategy, setSelectedStrategy] = useState<string>('general.bat')
  const [releaseInfo, setReleaseInfo] = useState<ZapretReleaseInfo | null>(null)
  const [checkingRelease, setCheckingRelease] = useState<boolean>(false)
  const [serviceResults, setServiceResults] = useState<ZapretServiceCheckResult | null>(null)
  const [checkingServices, setCheckingServices] = useState<boolean>(false)
  const [hostsLoading, setHostsLoading] = useState<boolean>(false)
  const [autoSelecting, setAutoSelecting] = useState<boolean>(false)
  const [autoSelectProgressText, setAutoSelectProgressText] = useState<string>('')

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getZapretStatus()
      setStatus(s)
      if (s.activeStrategy) {
        setSelectedStrategy(s.activeStrategy)
      } else if (s.strategies.length > 0 && !selectedStrategy) {
        setSelectedStrategy(s.strategies[0])
      }
    } catch (e) {
      console.error('Failed to get zapret status:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedStrategy])

  useEffect(() => {
    refreshStatus()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanup = (window.electron.ipcRenderer as any).on(
      'zapret-status-change',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_: any, data: any) => {
        if (data.status === 'downloading') {
          setDownloadProgress(data.progress ?? 0)
          setDownloadStatusText(`Загрузка архива (${data.progress ?? 0}%)...`)
        } else if (data.status === 'extracting') {
          setDownloadProgress(100)
          setDownloadStatusText('Распаковка и установка файлов...')
        } else {
          setDownloadProgress(null)
          setDownloadStatusText('')
          refreshStatus()
        }
      }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanupProgress = (window.electron.ipcRenderer as any).on(
      'zapret-autoselect-progress',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_: any, data: any) => {
        setAutoSelectProgressText(`Тестирование ${data.strategy} (${data.index}/${data.total})...`)
      }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanupComplete = (window.electron.ipcRenderer as any).on(
      'zapret-autoselect-complete',
      () => {
        setAutoSelecting(false)
        setAutoSelectProgressText('')
        refreshStatus()
      }
    )

    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup()
      if (cleanupProgress && typeof cleanupProgress === 'function') cleanupProgress()
      if (cleanupComplete && typeof cleanupComplete === 'function') cleanupComplete()
    }
  }, [refreshStatus])

  const handleCheckRelease = async (): Promise<void> => {
    setCheckingRelease(true)
    try {
      const rel = await checkZapretRelease()
      setReleaseInfo(rel)
      if (rel.hasUpdate) {
        toast.info(`Найдена новая версия Zapret: ${rel.version}`)
      } else {
        toast.success(`У вас установлена актуальная версия (${rel.version})`)
      }
    } catch (e) {
      toast.error(`Не удалось проверить обновления: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCheckingRelease(false)
    }
  }

  const handleInstallOrUpdate = async (): Promise<void> => {
    setOperating(true)
    setDownloadProgress(0)
    setDownloadStatusText('Подключение к GitHub...')
    try {
      const res = await downloadAndInstallZapret()
      toast.success(`Zapret успешно установлен (v${res.version})!`)
      await refreshStatus()
      setReleaseInfo(null)
    } catch (e) {
      toast.error(`Ошибка при установке Zapret: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setOperating(false)
      setDownloadProgress(null)
      setDownloadStatusText('')
    }
  }

  const handleToggleRunning = async (): Promise<void> => {
    if (!status?.installed) {
      toast.error('Сначала скачайте Zapret!')
      return
    }

    setOperating(true)
    try {
      if (status.running) {
        await stopZapret()
        toast.info('Zapret остановлен')
      } else {
        const strat = selectedStrategy || (status.strategies[0] ?? 'general.bat')
        toast.loading('Запуск Zapret и отключение VPN...', { id: 'zapret-run' })
        const res = await startZapret(strat)
        toast.dismiss('zapret-run')
        if (res.success) {
          toast.success(`Zapret запущен с выбранной стратегией: ${strat}`)
        } else {
          toast.warning('Запрос на запуск отправлен. Проверьте права администратора.')
        }
      }
      await refreshStatus()
    } catch (e) {
      toast.dismiss('zapret-run')
      toast.error(`Ошибка: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setOperating(false)
    }
  }

  const handleAutoSelect = async (): Promise<void> => {
    if (!status?.installed) {
      toast.error('Сначала скачайте Zapret!')
      return
    }

    setAutoSelecting(true)
    setAutoSelectProgressText('Запуск анализа стратегий...')
    toast.loading('Подбор рабочей стратегии...', { id: 'zapret-autoselect' })
    try {
      const res = await autoSelectZapretStrategy()
      toast.dismiss('zapret-autoselect')
      if (res.success && res.strategy) {
        toast.success(`Подобрана рабочая стратегия: ${res.strategy}!`)
        setSelectedStrategy(res.strategy)
        if (res.details) {
          setServiceResults(res.details)
        }
      } else {
        toast.error(res.message || 'Не удалось найти работающую стратегию')
      }
      await refreshStatus()
    } catch (e) {
      toast.dismiss('zapret-autoselect')
      toast.error(`Ошибка подбора: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAutoSelecting(false)
      setAutoSelectProgressText('')
    }
  }

  const handleCheckServices = async (): Promise<void> => {
    setCheckingServices(true)
    try {
      const results = await checkZapretServices()
      setServiceResults(results)
      if (results.youtube && results.discord) {
        toast.success('YouTube и Discord полностью доступны!')
      } else if (results.youtube || results.discord) {
        toast.warning(
          `Частичная доступность: YouTube ${results.youtube ? 'OK' : 'FAIL'}, Discord ${results.discord ? 'OK' : 'FAIL'}`
        )
      } else {
        toast.error('Сервисы недоступны. Попробуйте сменить стратегию обхода (ALT/ALT2/FAKE TLS).')
      }
    } catch (e) {
      toast.error(`Ошибка проверки: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCheckingServices(false)
    }
  }

  const handleApplyHosts = async (): Promise<void> => {
    setHostsLoading(true)
    try {
      await applyZapretHosts()
      toast.success('Hosts файл успешно обновлен и DNS очищен!')
      await refreshStatus()
    } catch (e) {
      toast.error(`Ошибка обновления hosts: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setHostsLoading(false)
    }
  }

  const handleRemoveHosts = async (): Promise<void> => {
    setHostsLoading(true)
    try {
      await removeZapretHosts()
      toast.info('Записи Zapret удалены из hosts файла')
      await refreshStatus()
    } catch (e) {
      toast.error(`Ошибка удаления hosts: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setHostsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 via-card/50 to-emerald-950/20 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <Zap className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">Zapret DPI Bypass</h1>
                {status?.running ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 px-2.5 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Активен
                  </Badge>
                ) : status?.installed ? (
                  <Badge variant="outline" className="text-zinc-400 border-white/10">
                    Остановлен
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-400/80 border-amber-500/20">
                    Не установлен
                  </Badge>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Автономный обход DPI для YouTube и Discord без внешних VPN-серверов (на базе Flowseal)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {status?.installed ? (
              <Button
                size="lg"
                disabled={operating || loading}
                onClick={handleToggleRunning}
                className={
                  status.running
                    ? 'bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-lg shadow-rose-950/40 w-full sm:w-auto'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-950/40 w-full sm:w-auto'
                }
              >
                {status.running ? (
                  <>
                    <Square className="w-4 h-4 mr-2 fill-current" />
                    Остановить Zapret
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Запустить Zapret
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={operating || loading}
                onClick={handleInstallOrUpdate}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-950/40 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Скачать Zapret
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-400">
          <AlertTriangle className="w-4 h-4 text-amber-400/70 shrink-0" />
          <span>
            <b>Взаимное исключение:</b> при запуске Zapret основной VPN (Mihomo) автоматически
            отключается во избежание конфликтов драйвера WinDivert.
          </span>
        </div>
      </div>

      {/* Download Progress Banner if active */}
      {downloadProgress !== null && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2 backdrop-blur-md">
          <div className="flex justify-between items-center text-sm">
            <span className="text-emerald-300 font-medium">{downloadStatusText}</span>
            <span className="text-emerald-400 font-mono text-xs">{downloadProgress}%</span>
          </div>
          <Progress value={downloadProgress} className="h-2 bg-emerald-950/50" />
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strategy Card */}
        <div className="rounded-2xl border border-white/5 bg-card/40 p-5 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Стратегия обхода DPI</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Выберите стратегию под вашего интернет-провайдера. По умолчанию рекомендуется{' '}
              <code className="text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded">general.bat</code>.
              Если видео зависают или Discord не подключается к голосовым каналам, переключитесь на ALT,
              ALT2 или FAKE TLS.
            </p>

            {status?.installed && status.strategies.length > 0 ? (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-zinc-300">Активный сценарий:</label>
                <Select
                  value={selectedStrategy}
                  onValueChange={(val) => setSelectedStrategy(val)}
                  disabled={operating}
                >
                  <SelectTrigger className="w-full bg-black/30 border-white/10 text-white font-mono text-sm">
                    <SelectValue placeholder="Выберите стратегию..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 bg-zinc-950 border-white/10 text-white">
                    {status.strategies.map((strat) => (
                      <SelectItem key={strat} value={strat} className="font-mono text-xs">
                        {strat} {strat === 'general.bat' ? '★ (Стандарт)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 italic py-3">
                Стратегии станут доступны после загрузки Zapret.
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            {status?.installed && (
              <Button
                size="sm"
                onClick={handleAutoSelect}
                disabled={autoSelecting || operating}
                className="bg-amber-600/90 hover:bg-amber-500 text-white w-full flex items-center justify-center gap-2"
              >
                <Sparkles className={`w-3.5 h-3.5 ${autoSelecting ? 'animate-spin' : ''}`} />
                <span>
                  {autoSelecting
                    ? autoSelectProgressText || 'Подбор рабочей стратегии...'
                    : '⚡ Автоподбор рабочей стратегии'}
                </span>
              </Button>
            )}

            {status?.running && selectedStrategy !== status.activeStrategy && (
              <Button
                size="sm"
                onClick={handleToggleRunning}
                disabled={operating || autoSelecting}
                className="bg-emerald-600/80 hover:bg-emerald-600 text-white w-full"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                Перезапустить с выбранной стратегией
              </Button>
            )}
          </div>
        </div>

        {/* Version & Updates Card */}
        <div className="rounded-2xl border border-white/5 bg-card/40 p-5 backdrop-blur-md flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <FileCode className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-semibold text-white">Версия и обновления Zapret</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Zapret скачивается напрямую из официального репозитория Flowseal в вашу рабочую папку
              без засорения основного репозитория программы.
            </p>

            <div className="bg-black/25 rounded-xl p-3 border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Установленная версия:</span>
                <span className="font-mono text-white font-medium">
                  {status?.version ? `v${status.version}` : 'Не установлена'}
                </span>
              </div>
              {status?.activeStrategy && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Текущий запуск:</span>
                  <span className="font-mono text-emerald-400">{status.activeStrategy}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={checkingRelease || operating}
              onClick={handleCheckRelease}
              className="border-white/10 hover:bg-white/5 text-zinc-200 text-xs flex-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${checkingRelease ? 'animate-spin' : ''}`} />
              Проверить релиз
            </Button>

            {(!status?.installed || releaseInfo?.hasUpdate) && (
              <Button
                size="sm"
                disabled={operating}
                onClick={handleInstallOrUpdate}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex-1"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {status?.installed ? 'Обновить' : 'Скачать'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Service Availability Tester Card */}
      <div className="rounded-2xl border border-white/5 bg-card/40 p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Проверка доступности сервисов</h2>
            </div>
            <p className="text-xs text-zinc-400">
              Прямое тестирование доступности без пинга (проверяет реальный пропуск потоков
              googlevideo и discord gateway через DPI).
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleCheckServices}
            disabled={checkingServices}
            className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${checkingServices ? 'animate-spin' : ''}`} />
            Проверить доступность
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* YouTube Status */}
          <div className="p-4 rounded-xl border border-white/5 bg-black/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                YouTube
              </span>
              {serviceResults ? (
                serviceResults.youtube ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Доступен
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">
                    Заблокирован
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-white/5">
                  Не проверялся
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Веб-интерфейс (youtube.com):</span>
                {serviceResults ? (
                  serviceResults.details.youtubeWeb ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Видеопоток (googlevideo):</span>
                {serviceResults ? (
                  serviceResults.details.youtubeVideo ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Discord Status */}
          <div className="p-4 rounded-xl border border-white/5 bg-black/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                Discord
              </span>
              {serviceResults ? (
                serviceResults.discord ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Доступен
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">
                    Заблокирован
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-white/5">
                  Не проверялся
                </Badge>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Веб-клиент (discord.com):</span>
                {serviceResults ? (
                  serviceResults.details.discordWeb ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Голос и шлюз (gateway):</span>
                {serviceResults ? (
                  serviceResults.details.discordGateway ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  )
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hosts Optimization Card */}
      <div className="rounded-2xl border border-white/5 bg-card/40 p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">Оптимизация файла hosts</h2>
              {status?.hostsInstalled ? (
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 ml-2">
                  Применен
                </Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 border-white/10 ml-2">
                  Не применен
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Направляет голосовые серверы Discord и CDN напрямую через официальный список Flowseal,
              предотвращая отравление DNS провайдером.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {status?.hostsInstalled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={hostsLoading}
                onClick={handleRemoveHosts}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-950/20 text-xs"
              >
                Удалить из hosts
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={hostsLoading}
                onClick={handleApplyHosts}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Применить hosts
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ZapretPage
