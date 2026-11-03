import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { cn } from '@renderer/lib/utils'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import { parseServerNode, getPingClass } from '@renderer/utils/proxy-node'
import CountryFlag from '@renderer/components/common/country-flag'
import { MapPin, CheckCircle2, ShieldCheck } from 'lucide-react'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (
    proxy: ControllerProxiesDetail | ControllerGroupDetail,
    url?: string
  ) => Promise<ControllerProxiesDelay>
  proxyDisplayLayout?: 'hidden' | 'single' | 'double'
  proxy: ControllerProxiesDetail | ControllerGroupDetail
  group: ControllerMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
  isGroupDelaying?: boolean
  reliability?: number
}

const ProxyItem: React.FC<Props> = React.memo((props) => {
  const {
    mutateProxies,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay,
    isGroupDelaying,
    reliability
  } = props

  const cardRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [justDiscovered, setJustDiscovered] = useState(false)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const delay = useMemo(() => {
    if (proxy.history && proxy.history.length > 0) {
      return proxy.history[proxy.history.length - 1].delay
    }
    return -1
  }, [proxy])

  const triggerSonarAnimation = useCallback(() => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    setAnimKey((k) => k + 1)
    setJustDiscovered(true)
    animTimerRef.current = setTimeout(() => {
      setJustDiscovered(false)
    }, 900)
  }, [])

  // When group delay test finishes for this proxy (transition from true -> false), trigger animation!
  const prevGroupDelayingRef = useRef(isGroupDelaying)
  useEffect(() => {
    if (prevGroupDelayingRef.current && !isGroupDelaying) {
      triggerSonarAnimation()
    }
    prevGroupDelayingRef.current = isGroupDelaying
  }, [isGroupDelaying, triggerSonarAnimation])

  // Also if delay value changes from any external update
  const prevDelayRef = useRef(delay)
  useEffect(() => {
    if (prevDelayRef.current !== -1 && delay !== prevDelayRef.current) {
      triggerSonarAnimation()
    }
    prevDelayRef.current = delay
  }, [delay, triggerSonarAnimation])

  const isDelaying = loading || isGroupDelaying

  const onDelay = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation()
      if (isDelaying) return
      setLoading(true)
      onProxyDelay(proxy, group?.testUrl)
        .then(() => {
          triggerSonarAnimation()
        })
        .catch(() => {
          // Even on timeout or failure, play the animation
          triggerSonarAnimation()
        })
        .finally(() => {
          mutateProxies()
          setLoading(false)
        })
    },
    [isDelaying, onProxyDelay, proxy, group, mutateProxies, triggerSonarAnimation]
  )

  const { countryCode, displayName } = useMemo(() => {
    return parseServerNode(proxy.name)
  }, [proxy.name])

  const displayType = useMemo(() => {
    if (!('all' in proxy) && proxy.serverDescription) return proxy.serverDescription
    return proxy.type || 'VLESS'
  }, [proxy])

  const fixed = group?.fixed && group.fixed === proxy.name

  // 3D Perspective Tilt on Hover (Prompt Motion Signature)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    card.style.setProperty('--mouse-x', `${x}px`)
    card.style.setProperty('--mouse-y', `${y}px`)

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -5
    const rotateY = ((x - centerX) / centerX) * 5

    card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px) scale3d(1.01, 1.01, 1.01)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale3d(1, 1, 1)'
  }, [])

  const isLowPing = delay > 0 && delay < 120

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect(group.name, proxy.name)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'pm-card server-card select-none cursor-pointer relative overflow-hidden transition-all',
        selected && 'active',
        fixed && 'border-amber-500/40 bg-amber-500/5'
      )}
    >
      <div className="server-card-top flex items-center justify-between">
        <div className="server-card-name flex items-center gap-2.5 min-w-0 pr-2">
          {/* Vector SVG Country Flag Badge */}
          <CountryFlag countryCode={countryCode} />
          <span className="font-semibold text-sm truncate" title={proxy.name}>
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {fixed && (
            <button
              type="button"
              title="Открепить узел"
              onClick={async (e) => {
                e.stopPropagation()
                await mihomoUnfixedProxy(group.name)
                mutateProxies()
              }}
              className="text-amber-400 hover:text-amber-300 transition-colors p-1"
            >
              <MapPin className="size-3.5" />
            </button>
          )}

          <span
            key={`ping-${animKey}`}
            onClick={onDelay}
            title="Нажмите для проверки задержки"
            className={cn(
              'ping-tag shrink-0 cursor-pointer font-mono text-xs transition-all duration-300',
              getPingClass(delay),
              isDelaying && 'opacity-80',
              justDiscovered && 'pinging'
            )}
          >
            {isDelaying ? (
              <span className="flex items-center gap-1.5 px-1">
                <span className="live-dot size-1.5 animate-pulse" />
                <span className="text-[11px]">тест...</span>
              </span>
            ) : delay === 0 ? (
              'Таймаут'
            ) : delay === -1 ? (
              <span className="text-muted-foreground">– ms</span>
            ) : (
              <span className="flex items-center gap-1 font-semibold">
                {selected && <CheckCircle2 className="size-3 text-emerald-400" />}
                <span>{delay} ms</span>
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Tags row: Clean protocol + Reliability Score Badge */}
      <div className="server-tags flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={cn('srv-badge font-mono', isLowPing && 'fast')}>{displayType}</span>
        {isLowPing && <span className="srv-badge fast">Быстрый</span>}
        {reliability !== undefined && (
          <span
            title={`Рейтинг надёжности и аптайма узла: ${reliability}%`}
            className={cn(
              'srv-badge font-mono flex items-center gap-1',
              reliability >= 85
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                : reliability >= 60
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/25'
            )}
          >
            <ShieldCheck className="size-2.5" />
            <span>{reliability}%</span>
          </span>
        )}
      </div>
    </div>
  )
})

ProxyItem.displayName = 'ProxyItem'
export default ProxyItem
