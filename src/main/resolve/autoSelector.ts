import https from 'https'
import { getAppConfig } from '../config/app'
import {
  mihomoGroups,
  mihomoProxyDelay,
  mihomoChangeProxy,
  mihomoCloseAllConnections
} from '../core/mihomoApi'
import { getCoreState } from '../core/status'
import { mainWindow } from '..'

// Timers
let autoSelectTimer: NodeJS.Timeout | null = null
let watchdogTimer: NodeJS.Timeout | null = null

const SPECIAL_PROXIES = new Set(['DIRECT', 'REJECT', 'GLOBAL', 'COMPATIBLE', 'PASS'])

// --- 1. Server Quality & Reliability Store (In-Memory) ---
export interface ServerMetric {
  name: string
  emaDelay: number
  lastDelay: number
  successCount: number
  failCount: number
  consecutiveWins: number
  reliability: number // 0 to 100%
  lastTested: number
}

const serverMetricsMap = new Map<string, ServerMetric>()

export async function getServerMetrics(): Promise<Record<string, ServerMetric>> {
  const result: Record<string, ServerMetric> = {}
  for (const [key, value] of serverMetricsMap.entries()) {
    result[key] = { ...value }
  }
  return result
}

function updateServerSample(name: string, delay: number): ServerMetric {
  let m = serverMetricsMap.get(name)
  if (!m) {
    m = {
      name,
      emaDelay: delay > 0 ? delay : 500,
      lastDelay: delay,
      successCount: delay > 0 ? 1 : 0,
      failCount: delay === 0 ? 1 : 0,
      consecutiveWins: 0,
      reliability: delay > 0 ? 100 : 40,
      lastTested: Date.now()
    }
  } else {
    m.lastTested = Date.now()
    m.lastDelay = delay
    if (delay > 0) {
      m.successCount++
      // If delay was an extreme spike (> 1800 ms), down-weight its influence on EMA
      const sample = delay > 1800 && m.emaDelay < 300 ? m.emaDelay * 1.5 : delay
      // EMA formula (alpha = 0.35)
      m.emaDelay = Math.round(0.35 * sample + 0.65 * m.emaDelay)
    } else {
      m.failCount++
      // Timeout penalty on EMA
      m.emaDelay = Math.max(m.emaDelay, 500)
    }

    const total = m.successCount + m.failCount
    if (total > 0) {
      const rawPct = (m.successCount / total) * 100
      // Heavy penalty for recent timeouts
      const recentPenalty = m.failCount * 5
      m.reliability = Math.max(10, Math.min(100, Math.round(rawPct - recentPenalty)))
    }
  }

  serverMetricsMap.set(name, m)
  return m
}

// Check local direct internet (Baseline check to differentiate home Wi-Fi drops vs server outages)
async function testDirectInternetBaseline(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get(
      'https://www.gstatic.com/generate_204',
      { timeout: 2500, headers: { 'User-Agent': 'UzurNet-Baseline' } },
      (res) => {
        resolve(res.statusCode === 204 || res.statusCode === 200)
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

export function createExcludeMatcher(patternStr?: string): (name: string) => boolean {
  if (!patternStr || !patternStr.trim()) return () => false
  const patterns = patternStr
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (patterns.length === 0) return () => false

  const regexes = patterns.map((p) => {
    try {
      return new RegExp(p, 'i')
    } catch {
      return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }
  })

  return (name: string) => regexes.some((re) => re.test(name))
}

interface AutoSelectGroupResult {
  group: string
  switched: boolean
  previous: string
  current: string
  delay: number
  testedCount: number
  excludedCount: number
}

export interface AutoSelectResult {
  success: boolean
  results: AutoSelectGroupResult[]
  message?: string
}

async function testWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      try {
        results[idx] = await fn(items[idx])
      } catch (e) {
        results[idx] = e as R
      }
    }
  })

  await Promise.all(workers)
  return results
}

// --- 2. Smart Auto-Select Logic with Hysteresis & Scoring ---
export async function runAutoSelect(manual = false): Promise<AutoSelectResult> {
  if (getCoreState().status !== 'running') {
    return { success: false, results: [], message: 'Core is not running' }
  }

  const config = await getAppConfig()
  const {
    autoSelectTolerance = 30,
    autoSelectExcludePatterns = '',
    autoCloseConnection = true,
    delayTestConcurrency = 25,
    autoSelectNotify = true
  } = config

  const isExcluded = createExcludeMatcher(autoSelectExcludePatterns)
  const groups = await mihomoGroups()

  const selectorGroups = groups.filter((g) => g.type === 'Selector' && g.all && g.all.length > 0)
  if (selectorGroups.length === 0) {
    return { success: false, results: [], message: 'No selector groups found' }
  }

  const finalResults: AutoSelectGroupResult[] = []

  for (const group of selectorGroups) {
    const rawCandidates = group.all.filter((proxy) => {
      if (!proxy || !proxy.name) return false
      if (SPECIAL_PROXIES.has(proxy.name.toUpperCase())) return false
      return true
    })

    const excludedCount = rawCandidates.filter((p) => isExcluded(p.name)).length
    const candidates = rawCandidates.filter((p) => !isExcluded(p.name))

    if (candidates.length === 0) {
      continue
    }

    // Run delay test concurrently
    const delays = await testWithConcurrency(candidates, delayTestConcurrency, async (proxy) => {
      const providerName = 'provider-name' in proxy ? proxy['provider-name'] : undefined
      try {
        const res = await mihomoProxyDelay(proxy.name, undefined, providerName)
        const d = res.delay || 0
        updateServerSample(proxy.name, d)
        return { name: proxy.name, delay: d }
      } catch {
        updateServerSample(proxy.name, 0)
        return { name: proxy.name, delay: 0 }
      }
    })

    // Send updated metrics to UI
    mainWindow?.webContents.send('serverMetricsUpdated', getServerMetrics())

    const working = delays.filter((d) => d && d.delay > 0)

    if (working.length === 0) {
      continue
    }

    // Sort by Effective Weighted Score: EMA delay penalised by unreliability
    const scored = working.map((w) => {
      const metric = serverMetricsMap.get(w.name)
      const reliability = metric?.reliability ?? 80
      const ema = metric?.emaDelay ?? w.delay
      // Score formula: low score = better
      const penalty = (100 - reliability) * 1.5
      const effectiveScore = ema + penalty
      return {
        ...w,
        ema,
        effectiveScore,
        metric
      }
    })

    scored.sort((a, b) => a.effectiveScore - b.effectiveScore)
    const best = scored[0]

    const currentName = group.now
    const currentProxyResult = scored.find((p) => p.name === currentName)

    let shouldSwitch = false

    if (!currentProxyResult || currentProxyResult.delay === 0) {
      // CURRENT NODE IS DEAD OR EXCLUDED! Immediate emergency switch!
      shouldSwitch = true
    } else {
      // Current node is alive. Evaluate dynamic tolerance & 2-round stability
      const dynamicTolerance = Math.max(autoSelectTolerance, Math.round(currentProxyResult.ema * 0.25))

      if (currentProxyResult.effectiveScore > best.effectiveScore + dynamicTolerance) {
        if (best.metric) {
          best.metric.consecutiveWins = (best.metric.consecutiveWins || 0) + 1
        }
        // Manual trigger skips hysteresis; periodic auto-select requires 2 stable rounds
        if (manual || (best.metric && best.metric.consecutiveWins >= 2)) {
          shouldSwitch = true
        }
      } else {
        if (best.metric) {
          best.metric.consecutiveWins = 0
        }
      }
    }

    if (shouldSwitch && best.name !== currentName) {
      await mihomoChangeProxy(group.name, best.name)
      // Reset win counter after successful switch
      if (best.metric) best.metric.consecutiveWins = 0

      // Always close stale connections to prevent dead socket stalls!
      if (autoCloseConnection) {
        await mihomoCloseAllConnections(group.name).catch(() => {})
      }

      finalResults.push({
        group: group.name,
        switched: true,
        previous: currentName,
        current: best.name,
        delay: best.delay,
        testedCount: candidates.length,
        excludedCount
      })
    } else {
      finalResults.push({
        group: group.name,
        switched: false,
        previous: currentName,
        current: currentName,
        delay: currentProxyResult ? currentProxyResult.delay : best.delay,
        testedCount: candidates.length,
        excludedCount
      })
    }
  }

  if (finalResults.some((r) => r.switched)) {
    mainWindow?.webContents.send('groupsUpdated')
  }

  mainWindow?.webContents.send('autoSelectCompleted', {
    manual,
    notify: autoSelectNotify !== false,
    results: finalResults
  })

  return { success: true, results: finalResults }
}

// --- 3. Emergency Watchdog (Monitors ONLY active server every 4 seconds) ---
let isWatchdogChecking = false

async function runWatchdogCheck(): Promise<void> {
  if (isWatchdogChecking || getCoreState().status !== 'running') return
  isWatchdogChecking = true

  try {
    const groups = await mihomoGroups().catch(() => [])
    const selectorGroups = groups.filter((g) => g.type === 'Selector' && g.now)

    for (const group of selectorGroups) {
      const activeName = group.now
      if (!activeName || SPECIAL_PROXIES.has(activeName.toUpperCase())) continue

      let isTimeout = false
      try {
        const res = await mihomoProxyDelay(activeName, undefined, undefined)
        if (!res || !res.delay) {
          isTimeout = true
        } else {
          updateServerSample(activeName, res.delay)
        }
      } catch {
        isTimeout = true
      }

      if (isTimeout) {
        // Quick 1-second retry to confirm failure before panic switching
        await new Promise((r) => setTimeout(r, 1000))
        let confirmedDead = false
        try {
          const retryRes = await mihomoProxyDelay(activeName, undefined, undefined)
          if (!retryRes || !retryRes.delay) {
            confirmedDead = true
          } else {
            updateServerSample(activeName, retryRes.delay)
          }
        } catch {
          confirmedDead = true
        }

        if (confirmedDead) {
          // Check if user's own home network / Wi-Fi is down
          const homeInternetAlive = await testDirectInternetBaseline()
          if (!homeInternetAlive) {
            // Local internet glitch, do NOT flap proxies!
            continue
          }

          // Active server died! Switch immediately to top reliable candidate
          updateServerSample(activeName, 0)
          const allCandidates = (group.all || []).filter(
            (p) => p && p.name && p.name !== activeName && !SPECIAL_PROXIES.has(p.name.toUpperCase())
          )

          // Pick candidate with best reliability score
          const ranked = allCandidates.map((c) => {
            const m = serverMetricsMap.get(c.name)
            return {
              name: c.name,
              score: m ? m.reliability : 50,
              delay: m?.emaDelay || 150
            }
          })
          ranked.sort((a, b) => b.score - a.score || a.delay - b.delay)

          const emergencyNode = ranked[0]
          if (emergencyNode) {
            console.log(`[Watchdog] Active server ${activeName} dead. Emergency switch to ${emergencyNode.name}`)
            await mihomoChangeProxy(group.name, emergencyNode.name)
            // Immediately terminate all lingering dead sockets!
            await mihomoCloseAllConnections(group.name).catch(() => {})

            mainWindow?.webContents.send('groupsUpdated')
            mainWindow?.webContents.send('serverWatchdogEmergencySwitch', {
              group: group.name,
              deadServer: activeName,
              newServer: emergencyNode.name
            })
          }
        }
      }
    }
  } catch (err) {
    // ignore
  } finally {
    isWatchdogChecking = false
  }
}

export function restartAutoSelectTimer(intervalMinutes?: number, enabled?: boolean): void {
  if (autoSelectTimer) {
    clearInterval(autoSelectTimer)
    autoSelectTimer = null
  }
  if (watchdogTimer) {
    clearInterval(watchdogTimer)
    watchdogTimer = null
  }

  getAppConfig().then((config) => {
    const isEnabled = enabled !== undefined ? enabled : config.autoSelectLowestDelay
    const minutes = intervalMinutes !== undefined ? intervalMinutes : config.autoSelectInterval || 10

    if (isEnabled) {
      // 1. Optimization cycle (every N minutes)
      const intervalMs = Math.max(1, minutes) * 60 * 1000
      autoSelectTimer = setInterval(() => {
        void runAutoSelect(false).catch((err) => {
          console.error('[AutoSelector] Background check error:', err)
        })
      }, intervalMs)

      // 2. Emergency Watchdog (every 4 seconds)
      watchdogTimer = setInterval(() => {
        void runWatchdogCheck()
      }, 4000)
    }
  })
}

export function stopAutoSelectTimer(): void {
  if (autoSelectTimer) {
    clearInterval(autoSelectTimer)
    autoSelectTimer = null
  }
  if (watchdogTimer) {
    clearInterval(watchdogTimer)
    watchdogTimer = null
  }
}
