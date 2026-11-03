import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import EditRulesModal from '@renderer/components/profiles/edit-rules-modal'
import ProcessRuleDialog from '@renderer/components/rules/process-rule-dialog'
import { Virtuoso } from 'react-virtuoso'
import { useMemo, useState } from 'react'
import { Separator } from '@renderer/components/ui/separator'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { useRules } from '@renderer/hooks/use-rules'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Database, Pencil, AppWindow } from 'lucide-react'

const Rules: React.FC = () => {
  const { t } = useTranslation()
  const { rules } = useRules()
  const { profileConfig } = useProfileConfig()
  const [filter, setFilter] = useState('')
  const [showRulesEditor, setShowRulesEditor] = useState(false)
  const [showProcessPicker, setShowProcessPicker] = useState(false)
  const navigate = useNavigate()

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, filter) ||
        includesIgnoreCase(rule.type, filter) ||
        includesIgnoreCase(rule.proxy, filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage
      title={t('pages.rules.title')}
      header={
        <>
          {profileConfig?.current && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="app-nodrag flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                title="Добавить правило для запущенного приложения"
                onClick={() => setShowProcessPicker(true)}
              >
                <AppWindow className="size-3.5" />
                <span>Правило для приложения</span>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="app-nodrag"
                title={t('profile.editRule')}
                onClick={() => setShowRulesEditor(true)}
              >
                <Pencil className="size-4" />
              </Button>
            </>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            className="app-nodrag"
            title={t('pages.resources.title')}
            onClick={() => navigate('/resources')}
          >
            <Database className="text-lg" />
          </Button>
        </>
      }
    >
      {showProcessPicker && profileConfig?.current && (
        <ProcessRuleDialog
          open={showProcessPicker}
          onOpenChange={setShowProcessPicker}
          profileId={profileConfig.current}
        />
      )}
      {showRulesEditor && profileConfig?.current && (
        <EditRulesModal
          id={profileConfig.current}
          onClose={() => setShowRulesEditor(false)}
        />
      )}
      <div className="sticky top-0 z-40">
        <div className="flex px-2 pb-2">
          <Input
            className="h-8 text-sm"
            value={filter}
            placeholder={t('common.filter')}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Separator className="mx-2"/>
      </div>
      <div className="h-[calc(100vh-108px)] mt-px">
        <Virtuoso
          data={filteredRules}
          itemContent={(i, rule) => (
            <RuleItem
              index={i}
              type={rule.type}
              payload={rule.payload}
              proxy={rule.proxy}
              size={rule.size}
            />
          )}
        />
      </div>
    </BasePage>
  )
}

export default Rules
