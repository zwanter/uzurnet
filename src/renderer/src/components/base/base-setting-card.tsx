import React from 'react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@renderer/components/ui/accordion'

interface Props {
  title?: string
  children?: React.ReactNode
  className?: string
}

const SettingCard: React.FC<Props> = (props) => {
  return !props.title ? (
    <Card className={`${props.className || ''} mx-2 mb-3 rounded-lg border border-white/[0.07] bg-white/[0.04] backdrop-blur-xl shadow-xs`}>
      <CardContent className="px-4 py-3">{props.children}</CardContent>
    </Card>
  ) : (
    <Accordion
      className={`${props.className || ''} mx-2 mb-3 rounded-lg border border-white/[0.07] text-card-foreground shadow-xs bg-white/[0.04] backdrop-blur-xl overflow-hidden`}
      type="single"
      collapsible
      defaultValue={props.title}
      {...props}
    >
      <AccordionItem value={props.title} className="border-none">
        <AccordionTrigger className="px-4 py-3 text-[14px] font-medium hover:no-underline hover:bg-white/[0.02] transition-colors">
          {props.title}
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-1 pb-3 border-t border-white/[0.05]">
          {props.children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default SettingCard
