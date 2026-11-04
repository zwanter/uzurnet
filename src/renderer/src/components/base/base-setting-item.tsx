import { Separator } from '@renderer/components/ui/separator'

import React from 'react'

interface Props {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
}

const SettingItem: React.FC<Props> = (props) => {
  const { title, actions, children, divider = false } = props

  return (
    <>
      <div className="min-h-[44px] py-1.5 w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[13.5px] font-normal text-foreground leading-tight select-text">{title}</div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        <div className="shrink-0 flex items-center">{children}</div>
      </div>
      {divider && <Separator className="bg-border/50 dark:bg-white/[0.05] my-1" />}
    </>
  )
}

export default SettingItem
