import React from 'react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export interface ConfirmButton {
  key: string
  text: string
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link'
  onPress: () => void | Promise<void>
}

interface Props {
  onChange: (open: boolean) => void
  title?: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  buttons?: ConfirmButton[]
  className?: string
  showCloseButton?: boolean
  preventClose?: boolean
}

const ConfirmModal: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const {
    onChange,
    title,
    description,
    confirmText,
    cancelText,
    onConfirm,
    buttons,
    className,
    showCloseButton,
    preventClose
  } = props

  const modalTitle = title || t('modal.pleaseConfirm')
  const modalConfirmText = confirmText || t('common.confirm')
  const modalCancelText = cancelText || t('common.cancel')
  const actionButtonClassName =
    'w-full max-w-full whitespace-normal break-words text-center h-auto min-h-8 py-2 sm:w-auto'
  const closeRef = React.useRef<HTMLButtonElement>(null)

  const closeWithAnimation = (): void => {
    closeRef.current?.click()
  }

  const renderButtons = () => {
    if (buttons && buttons.length > 0) {
      return buttons.map((button) => (
        <Button
          key={button.key}
          size="sm"
          color={button.color || 'primary'}
          variant={button.variant || 'default'}
          className={actionButtonClassName}
          onClick={async () => {
            await button.onPress()
            if (!preventClose) {
              closeWithAnimation()
            }
          }}
        >
          {button.text}
        </Button>
      ))
    }

    return (
      <>
        {!preventClose && (
          <DialogClose asChild>
            <Button size="sm" variant="ghost" className={actionButtonClassName}>
              {modalCancelText}
            </Button>
          </DialogClose>
        )}
        <Button
          size="sm"
          variant="destructive"
          className={actionButtonClassName}
          onClick={async () => {
            if (onConfirm) {
              await onConfirm()
            }
            if (!preventClose) {
              closeWithAnimation()
            }
          }}
        >
          {modalConfirmText}
        </Button>
      </>
    )
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (preventClose && !open) return
        onChange(open)
      }}
    >
      <DialogContent
        showCloseButton={showCloseButton ?? !preventClose}
        onPointerDownOutside={(e) => {
          if (preventClose) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (preventClose) e.preventDefault()
        }}
        className={cn('w-[min(500px,calc(100%-2rem))]', className)}
      >
        <DialogClose ref={closeRef} className="hidden" />
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:flex-wrap sm:justify-end">{renderButtons()}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
export default ConfirmModal
