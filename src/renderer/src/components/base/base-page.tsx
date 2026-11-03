import { Button } from '@renderer/components/ui/button'
import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const sidebarPaths = new Set(['/home', '/profiles', '/proxies', '/connections', '/rules', '/logs', '/settings'])

interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
  showBackButton?: boolean
}

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const location = useLocation()
  const navigate = useNavigate()
  const isSubPage = !sidebarPaths.has(location.pathname)

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  const hasHeaderBar = Boolean(props.title || props.header || isSubPage || props.showBackButton)

  return (
    <div ref={contentRef} className="w-full h-full flex flex-col min-h-0">
      {hasHeaderBar && (
        <div className="section-head-bar mb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {(isSubPage || props.showBackButton) && (
              <Button
                size="icon-sm"
                variant="ghost"
                className="cursor-pointer hover:bg-white/10"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="size-5" />
              </Button>
            )}
            {props.title && (
              <div>
                <div className="sec-title">{props.title}</div>
              </div>
            )}
          </div>
          {props.header && (
            <div className="flex items-center gap-2">
              {props.header}
            </div>
          )}
        </div>
      )}
      <div className={`flex-1 min-h-0 overflow-y-auto ${props.contentClassName || ''}`}>
        {props.children}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
