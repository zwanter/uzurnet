import React, { useState } from 'react'
import { toast } from 'sonner'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Switch } from '@renderer/components/ui/switch'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { runAutoSelectProxy } from '@renderer/utils/ipc'
import { useTranslation } from 'react-i18next'
import { Sparkles, MessageCircleQuestionMark } from 'lucide-react'

export const AutoSelectConfig: React.FC = () => {
  const { t } = useTranslation()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    autoSelectLowestDelay = false,
    autoSelectInterval = 10,
    autoSelectTolerance = 30,
    autoSelectExcludePatterns = '',
    autoSelectNotify = true
  } = appConfig || {}

  const [isRunning, setIsRunning] = useState(false)
  const [excludeValue, setExcludeValue] = useState(autoSelectExcludePatterns)
  const [intervalValue, setIntervalValue] = useState(String(autoSelectInterval))
  const [toleranceValue, setToleranceValue] = useState(String(autoSelectTolerance))

  const handleRunNow = async (): Promise<void> => {
    setIsRunning(true)
    try {
      const res = await runAutoSelectProxy()
      if (!res.success) {
        toast.warning(res.message || t('autoSelect.noCandidates', 'Нет доступных серверов'))
        return
      }
      const switchedResults = res.results.filter((r) => r.switched)
      if (switchedResults.length > 0) {
        switchedResults.forEach((r) => {
          toast.success(
            t('autoSelect.switchedToast', {
              group: r.group,
              proxy: r.current,
              delay: r.delay,
              defaultValue: `Группа [${r.group}]: выбран ${r.current} (${r.delay} мс)`
            })
          )
        })
      } else {
        const first = res.results[0]
        if (first) {
          toast.info(
            t('autoSelect.alreadyOptimal', {
              proxy: first.current,
              delay: first.delay,
              defaultValue: `Сервер [${first.current}] уже оптимален (${first.delay} мс)`
            })
          )
        } else {
          toast.info(t('autoSelect.noChanges', 'Изменений не требуется'))
        }
      }
    } catch (e) {
      toast.error(`${e}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <SettingCard title={t('autoSelect.cardTitle', 'Автовыбор сервера (минимальный пинг)')}>
      <SettingItem
        title={t('autoSelect.enable', 'Включить автовыбор с наименьшим пингом')}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MessageCircleQuestionMark className="text-lg" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t(
                'autoSelect.enableDesc',
                'Периодически тестирует серверы и переключается на узел с наименьшей задержкой'
              )}
            </TooltipContent>
          </Tooltip>
        }
        divider
      >
        <Switch
          checked={autoSelectLowestDelay}
          onCheckedChange={(value) => {
            patchAppConfig({ autoSelectLowestDelay: value })
          }}
        />
      </SettingItem>

      <SettingItem
        title={t('autoSelect.triggerNow', 'Быстрый запуск')}
        divider
      >
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={isRunning}
          onClick={handleRunNow}
        >
          {isRunning ? <Spinner className="size-4" /> : <Sparkles className="size-4 text-amber-500" />}
          {t('autoSelect.runButton', 'Выбрать лучший сервер')}
        </Button>
      </SettingItem>

      <SettingItem
        title={t('autoSelect.excludePatterns', 'Исключения (черный список)')}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MessageCircleQuestionMark className="text-lg" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t(
                'autoSelect.excludeHelp',
                'Слова или регулярные выражения через запятую, которые будут проигнорированы. Например: RU, Russia, x2, VIP, Filter'
              )}
            </TooltipContent>
          </Tooltip>
        }
        divider
      >
        <Input
          className="w-64"
          placeholder="RU, Russia, x2, VIP"
          value={excludeValue}
          onChange={(e) => setExcludeValue(e.target.value)}
          onBlur={() => {
            if (excludeValue !== autoSelectExcludePatterns) {
              patchAppConfig({ autoSelectExcludePatterns: excludeValue })
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              patchAppConfig({ autoSelectExcludePatterns: excludeValue })
            }
          }}
        />
      </SettingItem>

      <SettingItem
        title={t('autoSelect.interval', 'Интервал проверки (минуты)')}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MessageCircleQuestionMark className="text-lg" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('autoSelect.intervalDesc', 'Как часто автоматически проверять пинг в фоне')}
            </TooltipContent>
          </Tooltip>
        }
        divider
      >
        <Input
          type="number"
          min={1}
          max={1440}
          className="w-24"
          value={intervalValue}
          onChange={(e) => setIntervalValue(e.target.value)}
          onBlur={() => {
            const val = Math.max(1, parseInt(intervalValue, 10) || 10)
            setIntervalValue(String(val))
            patchAppConfig({ autoSelectInterval: val })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = Math.max(1, parseInt(intervalValue, 10) || 10)
              setIntervalValue(String(val))
              patchAppConfig({ autoSelectInterval: val })
            }
          }}
        />
      </SettingItem>

      <SettingItem
        title={t('autoSelect.tolerance', 'Порог переключения (мс)')}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MessageCircleQuestionMark className="text-lg" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t(
                'autoSelect.toleranceHelp',
                'Защита от частых переключений. Если текущий сервер медленнее лучшего менее чем на это значение, переключение не происходит.'
              )}
            </TooltipContent>
          </Tooltip>
        }
        divider
      >
        <Input
          type="number"
          min={0}
          max={1000}
          className="w-24"
          value={toleranceValue}
          onChange={(e) => setToleranceValue(e.target.value)}
          onBlur={() => {
            const val = Math.max(0, parseInt(toleranceValue, 10) || 0)
            setToleranceValue(String(val))
            patchAppConfig({ autoSelectTolerance: val })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = Math.max(0, parseInt(toleranceValue, 10) || 0)
              setToleranceValue(String(val))
              patchAppConfig({ autoSelectTolerance: val })
            }
          }}
        />
      </SettingItem>

      <SettingItem
        title={t('autoSelect.notify', 'Уведомления при переключении')}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <MessageCircleQuestionMark className="text-lg" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('autoSelect.notifyDesc', 'Показывать всплывающее уведомление, когда выбран новый лучший сервер')}
            </TooltipContent>
          </Tooltip>
        }
      >
        <Switch
          checked={autoSelectNotify}
          onCheckedChange={(value) => {
            patchAppConfig({ autoSelectNotify: value })
          }}
        />
      </SettingItem>
    </SettingCard>
  )
}

export default AutoSelectConfig
