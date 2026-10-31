import { getAppConfig } from '../config/app'
import {
  mihomoGroups,
  mihomoProxyDelay,
  mihomoChangeProxy,
  mihomoCloseAllConnections
} from '../core/mihomoApi'
import { getCoreState } from '../core/status'
import { mainWindow } from '..'

let autoSelectTimer: NodeJS.Timeout | null = null

const SPECIAL_PROXIES = new Set(['DIRECT', 'REJECT', 'GLOBAL', 'COMPATIBLE', 'PASS'])

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

export async function runAutoSelect(manual = false): Promise<AutoSelectResult> {
  if (getCoreState().status !== 'running') {
    return { success: false, results: [], message: 'Core is not running' }
  }

  const config = await getAppConfig()
  const {
    autoSelectTolerance = 30,
    autoSelectExcludePatterns = '',
    autoCloseConnection = true,
    delayTestConcurrency = 20
  } = config

  const isExcluded = createExcludeMatcher(autoSelectExcludePatterns)
  const groups = await mihomoGroups()

  // Select groups of type 'Selector'
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
        return { name: proxy.name, delay: res.delay }
      } catch {
        return { name: proxy.name, delay: 0 }
      }
    })

    const working = delays.filter(
      (d): d is { name: string; delay: number } =>
        Boolean(d && typeof d === 'object' && typeof (d as { delay?: number }).delay === 'number' && (d as { delay: number }).delay > 0)
    )
    if (working.length === 0) {
      continue
    }

    working.sort((a, b) => a.delay - b.delay)
    const best = working[0]

    const currentName = group.now
    const currentProxyResult = working.find((p) => p.name === currentName)

    let shouldSwitch = false
    if (!currentProxyResult) {
      // Current proxy is either down or was excluded!
      shouldSwitch = true
    } else {
      // If best proxy is faster than current by more than tolerance
      if (currentProxyResult.delay > best.delay + autoSelectTolerance) {
        shouldSwitch = true
      }
    }

    if (shouldSwitch && best.name !== currentName) {
      await mihomoChangeProxy(group.name, best.name)
      // For maximum seamless switching: only drop connections if current proxy was dead.
      // If current proxy was alive, existing sockets stay connected while all new traffic routes to the faster node.
      if (!currentProxyResult && autoCloseConnection) {
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
    results: finalResults
  })

  return { success: true, results: finalResults }
}

export function restartAutoSelectTimer(intervalMinutes?: number, enabled?: boolean): void {
  if (autoSelectTimer) {
    clearInterval(autoSelectTimer)
    autoSelectTimer = null
  }

  getAppConfig().then((config) => {
    const isEnabled = enabled !== undefined ? enabled : config.autoSelectLowestDelay
    const minutes = intervalMinutes !== undefined ? intervalMinutes : config.autoSelectInterval || 10

    if (isEnabled) {
      const intervalMs = Math.max(1, minutes) * 60 * 1000
      autoSelectTimer = setInterval(() => {
        void runAutoSelect(false).catch((err) => {
          console.error('[AutoSelector] Background check error:', err)
        })
      }, intervalMs)
    }
  })
}

export function stopAutoSelectTimer(): void {
  if (autoSelectTimer) {
    clearInterval(autoSelectTimer)
    autoSelectTimer = null
  }
}
