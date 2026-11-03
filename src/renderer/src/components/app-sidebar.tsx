import React, { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import dayjs from 'dayjs'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

interface NavItem {
  key: string
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    key: 'dashboard',
    path: '/home',
    label: 'Дашборд',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      </svg>
    )
  },
  {
    key: 'proxies',
    path: '/proxies',
    label: 'Прокси',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    )
  },
  {
    key: 'profiles',
    path: '/profiles',
    label: 'Профили',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    )
  },
  {
    key: 'connections',
    path: '/connections',
    label: 'Соединения',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    )
  },
  {
    key: 'rules',
    path: '/rules',
    label: 'Правила',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="21" x2="4" y2="14"></line>
        <line x1="4" y1="10" x2="4" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12" y2="3"></line>
        <line x1="20" y1="21" x2="20" y2="16"></line>
        <line x1="20" y1="12" x2="20" y2="3"></line>
        <line x1="1" y1="14" x2="7" y2="14"></line>
        <line x1="9" y1="8" x2="15" y2="8"></line>
        <line x1="17" y1="16" x2="23" y2="16"></line>
      </svg>
    )
  },
  {
    key: 'logs',
    path: '/logs',
    label: 'Логи',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
    )
  },
  {
    key: 'settings',
    path: '/settings',
    label: 'Настройки',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    )
  }
]

const AppSidebar: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { profileConfig } = useProfileConfig()

  const hasProfiles = (profileConfig?.items?.length ?? 0) > 0
  const currentProfile = profileConfig?.items?.find((i) => i.id === profileConfig.current)
  const subscription = currentProfile?.extra
  const trafficUsed = (subscription?.upload ?? 0) + (subscription?.download ?? 0)
  const trafficTotal = subscription?.total ?? 0
  const expireTimestamp = subscription?.expire ?? 0

  const hasUnlimitedTraffic = trafficTotal <= 0

  const daysRemaining = useMemo(() => {
    if (expireTimestamp <= 0) return 0
    return Math.max(0, dayjs.unix(expireTimestamp).diff(dayjs(), 'day'))
  }, [expireTimestamp])

  const percentUsed = useMemo(() => {
    if (!hasProfiles) return 0
    if (hasUnlimitedTraffic) return 100
    return Math.min(100, Math.max(5, Math.round((trafficUsed / trafficTotal) * 100)))
  }, [hasProfiles, hasUnlimitedTraffic, trafficUsed, trafficTotal])

  const trafficLabel = useMemo(() => {
    if (!hasProfiles) return '0 B'
    if (trafficTotal > 0) {
      return `${formatBytes(trafficUsed)} / ${formatBytes(trafficTotal)}`
    }
    if (trafficUsed > 0) {
      return `${formatBytes(trafficUsed)} / ∞`
    }
    return 'Безлимит (∞)'
  }, [hasProfiles, trafficTotal, trafficUsed])

  const daysLabel = useMemo(() => {
    if (!hasProfiles) return '–'
    if (expireTimestamp > 0) {
      return `${daysRemaining} дн.`
    }
    return 'Бессрочно'
  }, [hasProfiles, expireTimestamp, daysRemaining])

  const activeIndex = useMemo(() => {
    const idx = navItems.findIndex((item) =>
      item.path === '/home'
        ? location.pathname === '/' || location.pathname === '/home'
        : location.pathname.startsWith(item.path)
    )
    return idx >= 0 ? idx : 0
  }, [location.pathname])

  return (
    <aside className="sidebar shrink-0 select-none">
      {/* Morphing Indicator Pill */}
      <div
        className="nav-slider-pill"
        style={{
          transform: `translateY(${activeIndex * 44}px)`
        }}
      />

      {navItems.map((item, idx) => {
        const isActive = activeIndex === idx
        return (
          <div
            key={item.key}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <div className="nav-icon">{item.icon}</div>
            <span>{item.label}</span>
          </div>
        )
      })}

      <div className="sidebar-spacer" />

      {/* VIP Profile Widget with real data */}
      <div className="profile-footer-card" onClick={() => navigate('/profiles')}>
        <div className="profile-info">
          <span className="profile-title truncate max-w-[120px]">
            <span>💎</span> {currentProfile?.name || 'UzurNet'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 700 }}>
            {hasProfiles ? 'АКТИВЕН' : 'ОФФЛАЙН'}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percentUsed}%` }} />
        </div>
        <div className="traffic-stats">
          <span title={trafficLabel}>{trafficLabel}</span>
          <span title={daysLabel}>{daysLabel}</span>
        </div>
      </div>
    </aside>
  )
}

export default AppSidebar
