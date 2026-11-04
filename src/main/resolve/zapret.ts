import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { existsSync, readdirSync } from 'fs'
import { readFile, writeFile, mkdir, rm, cp } from 'fs/promises'
import axios from 'axios'
import { dataDir, resourcesFilesDir } from '../utils/dirs'
import { mainWindow } from '../index'

const execFilePromise = promisify(execFile)

export interface ZapretStatus {
  installed: boolean
  version: string | null
  installedAt?: number
  running: boolean
  activeStrategy: string | null
  selectedStrategy?: string
  strategies: string[]
  hostsInstalled: boolean
}

export interface ZapretServiceCheckResult {
  youtube: boolean
  discord: boolean
  details: {
    youtubeWeb: boolean
    youtubeVideo: boolean
    discordWeb: boolean
    discordGateway: boolean
  }
  timestamp: number
}

export interface ZapretReleaseInfo {
  version: string
  downloadUrl: string
  size: number
  name: string
  hasUpdate: boolean
}

export function getZapretDir(): string {
  return path.join(dataDir(), 'zapret')
}

export function getZapretBinDir(): string {
  return path.join(getZapretDir(), 'bin')
}

export function getZapretWinws(): string {
  return path.join(getZapretBinDir(), 'winws.exe')
}

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts'
const HOSTS_START_TAG = '# === UZURNET ZAPRET START ==='
const HOSTS_END_TAG = '# === UZURNET ZAPRET END ==='

async function getZapretMeta(): Promise<{
  version?: string
  installedAt?: number
  activeStrategy?: string
  selectedStrategy?: string
}> {
  try {
    const metaPath = path.join(getZapretDir(), 'version.json')
    if (existsSync(metaPath)) {
      const data = await readFile(metaPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.warn('[Zapret] Read meta error:', e)
  }
  return {}
}

export async function saveZapretMeta(patch: {
  version?: string
  installedAt?: number
  activeStrategy?: string
  selectedStrategy?: string
}): Promise<void> {
  try {
    const zapretDir = getZapretDir()
    if (!existsSync(zapretDir)) {
      await mkdir(zapretDir, { recursive: true })
    }
    const current = await getZapretMeta()
    const updated = { ...current, ...patch }
    await writeFile(path.join(zapretDir, 'version.json'), JSON.stringify(updated, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[Zapret] Save meta error:', e)
  }
}

export async function saveSelectedStrategy(strategy: string): Promise<void> {
  await saveZapretMeta({ selectedStrategy: strategy })
}

export async function isZapretRunning(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try {
    const { stdout } = await execFilePromise('tasklist', ['/FI', 'IMAGENAME eq winws.exe', '/NH'])
    return stdout.toLowerCase().includes('winws.exe')
  } catch {
    return false
  }
}

export function getAvailableStrategies(): string[] {
  const zapretDir = getZapretDir()
  if (!existsSync(zapretDir)) return []
  try {
    const files = readdirSync(zapretDir)
    const batFiles = files.filter(
      (f) =>
        f.toLowerCase().endsWith('.bat') &&
        !f.toLowerCase().startsWith('service') &&
        !f.toLowerCase().includes('runner')
    )

    // Sort order: general.bat first, then general (ALT*), then others
    batFiles.sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      if (aLower === 'general.bat') return -1
      if (bLower === 'general.bat') return 1
      return aLower.localeCompare(bLower)
    })

    return batFiles
  } catch {
    return []
  }
}

export async function checkHostsInstalled(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try {
    if (!existsSync(HOSTS_PATH)) return false
    const content = await readFile(HOSTS_PATH, 'utf-8')
    return content.includes(HOSTS_START_TAG)
  } catch {
    return false
  }
}

export async function getZapretStatus(): Promise<ZapretStatus> {
  const installed = existsSync(getZapretWinws())
  const meta = await getZapretMeta()
  const running = await isZapretRunning()
  const strategies = getAvailableStrategies()
  const hostsInstalled = await checkHostsInstalled()
  const savedStrategy = meta.selectedStrategy || meta.activeStrategy || (strategies[0] ?? 'general.bat')

  return {
    installed,
    version: meta.version || (installed ? 'Installed' : null),
    installedAt: meta.installedAt,
    running,
    activeStrategy: running ? meta.activeStrategy || savedStrategy : null,
    selectedStrategy: savedStrategy,
    strategies,
    hostsInstalled
  }
}

export async function checkZapretRelease(): Promise<ZapretReleaseInfo> {
  const res = await axios.get('https://api.github.com/repos/Flowseal/zapret-discord-youtube/releases/latest', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UzurNet'
    },
    timeout: 10000
  })

  const release = res.data
  const tag = release.tag_name || ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zipAsset = release.assets?.find((a: any) => a.name.endsWith('.zip'))

  if (!zipAsset) {
    throw new Error('ZIP архив релиза Zapret не найден в репозитории Flowseal.')
  }

  const meta = await getZapretMeta()
  const hasUpdate = !meta.version || meta.version !== tag

  return {
    version: tag,
    downloadUrl: zipAsset.browser_download_url,
    size: zipAsset.size,
    name: zipAsset.name,
    hasUpdate
  }
}

export async function downloadAndInstallZapret(): Promise<{ success: boolean; version: string }> {
  // 1. Stop any currently running Zapret
  await stopZapretProcess()

  const releaseInfo = await checkZapretRelease()
  const zapretDir = getZapretDir()
  const tempZipPath = path.join(dataDir(), 'zapret_download.zip')
  const tempExtractDir = path.join(dataDir(), 'zapret_extract_tmp')

  mainWindow?.webContents.send('zapret-status-change', {
    status: 'downloading',
    progress: 0
  })

  try {
    // 2. Download zip archive
    const response = await axios.get(releaseInfo.downloadUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UzurNet'
      },
      onDownloadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
        mainWindow?.webContents.send('zapret-status-change', {
          status: 'downloading',
          progress: percent
        })
      }
    })

    await writeFile(tempZipPath, Buffer.from(response.data))

    mainWindow?.webContents.send('zapret-status-change', {
      status: 'extracting',
      progress: 100
    })

    // 3. Extract using 7za.exe
    const sevenZip = path.join(resourcesFilesDir(), '7za.exe')
    if (existsSync(tempExtractDir)) {
      await rm(tempExtractDir, { recursive: true, force: true })
    }
    await mkdir(tempExtractDir, { recursive: true })

    await execFilePromise(sevenZip, ['x', tempZipPath, `-o${tempExtractDir}`, '-y'])

    // 4. Find root directory inside extract
    const extractedItems = readdirSync(tempExtractDir)
    let sourceContentDir = tempExtractDir
    if (
      extractedItems.length === 1 &&
      existsSync(path.join(tempExtractDir, extractedItems[0], 'bin'))
    ) {
      sourceContentDir = path.join(tempExtractDir, extractedItems[0])
    }

    if (!existsSync(zapretDir)) {
      await mkdir(zapretDir, { recursive: true })
    }

    // 5. Copy extracted files into zapretDir
    await cp(sourceContentDir, zapretDir, { recursive: true })

    // 6. Ensure user lists exist so winws doesn't fail
    const listsDir = path.join(zapretDir, 'lists')
    if (!existsSync(listsDir)) {
      await mkdir(listsDir, { recursive: true })
    }
    const ipsetExclude = path.join(listsDir, 'ipset-exclude-user.txt')
    if (!existsSync(ipsetExclude)) {
      await writeFile(ipsetExclude, '203.0.113.113/32\r\n', 'utf-8')
    }
    const generalUser = path.join(listsDir, 'list-general-user.txt')
    if (!existsSync(generalUser)) {
      await writeFile(generalUser, '# Never leave this file empty\r\ndomain.example.abc\r\n', 'utf-8')
    }
    const excludeUser = path.join(listsDir, 'list-exclude-user.txt')
    if (!existsSync(excludeUser)) {
      await writeFile(excludeUser, 'domain.example.abc\r\n', 'utf-8')
    }

    // 7. Enable TCP timestamps for optimal DPI bypass
    try {
      await execFilePromise('netsh', ['interface', 'tcp', 'set', 'global', 'timestamps=enabled']).catch(() => {})
    } catch {}

    // 8. Save version metadata
    await saveZapretMeta({
      version: releaseInfo.version,
      installedAt: Date.now()
    })

    mainWindow?.webContents.send('zapret-status-change', {
      status: 'installed',
      progress: 100
    })

    return { success: true, version: releaseInfo.version }
  } finally {
    // Cleanup temporary files
    try {
      if (existsSync(tempZipPath)) await rm(tempZipPath, { force: true })
      if (existsSync(tempExtractDir)) await rm(tempExtractDir, { recursive: true, force: true })
    } catch {}
  }
}

function extractWinwsArgs(batContent: string, zapretDir: string): string | null {
  // Join lines split with ^
  const joined = batContent.replace(/\^\r?\n/g, ' ')
  const lines = joined.split(/\r?\n/)

  for (const line of lines) {
    const match = line.match(/(?:start[^\n]*?)?"%BIN%winws\.exe"\s+(.*)/i) || line.match(/winws\.exe"\s+(.*)/i)
    if (match) {
      let rawArgs = match[1].trim()
      const binDir = path.join(zapretDir, 'bin') + '\\'
      const listsDir = path.join(zapretDir, 'lists') + '\\'
      rawArgs = rawArgs.replace(/%BIN%/gi, binDir)
      rawArgs = rawArgs.replace(/%LISTS%/gi, listsDir)
      rawArgs = rawArgs.replace(/%GameFilterTCP%/gi, '12')
      rawArgs = rawArgs.replace(/%GameFilterUDP%/gi, '12')
      rawArgs = rawArgs.replace(/%GameFilter%/gi, '12')
      return rawArgs
    }
  }
  return null
}

export async function stopZapretProcess(): Promise<void> {
  if (process.platform !== 'win32') return

  // 1. First attempt: standard taskkill (works if app itself is elevated)
  try {
    await execFilePromise('taskkill', ['/F', '/IM', 'winws.exe', '/T']).catch(() => {})
  } catch {}

  // 2. Check if winws.exe is still running (Access Denied for unprivileged caller)
  let running = await isZapretRunning()
  if (running) {
    try {
      // Elevated taskkill + stop WinDivert via RunAs
      await execFilePromise('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Start-Process cmd.exe -ArgumentList '/c', 'taskkill /F /IM winws.exe /T & net stop WinDivert & sc delete WinDivert & net stop WinDivert14 & sc delete WinDivert14' -Verb RunAs -WindowStyle Hidden -Wait`
      ]).catch(() => {})
    } catch (e) {
      console.warn('[Zapret] Elevated stop error:', e)
    }
  }

  // 3. Verify that winws.exe is really gone (polling up to 3 seconds)
  for (let i = 0; i < 15; i++) {
    running = await isZapretRunning()
    if (!running) break
    await new Promise((r) => setTimeout(r, 200))
  }

  // 4. Cleanup WinDivert driver service
  try {
    await execFilePromise('net', ['stop', 'WinDivert']).catch(() => {})
    await execFilePromise('sc', ['delete', 'WinDivert']).catch(() => {})
    await execFilePromise('net', ['stop', 'WinDivert14']).catch(() => {})
    await execFilePromise('sc', ['delete', 'WinDivert14']).catch(() => {})
  } catch {}
}

export async function stopZapret(): Promise<{ success: boolean }> {
  await stopZapretProcess()
  const stillRunning = await isZapretRunning()
  if (stillRunning) {
    throw new Error('Не удалось завершить процесс winws.exe. Пожалуйста, подтвердите права администратора.')
  }

  await saveZapretMeta({ activeStrategy: undefined })
  mainWindow?.webContents.send('zapret-status-change', {
    status: 'stopped',
    running: false
  })

  // Restart Mihomo core in the background so it is instantly ready for VPN mode
  try {
    const { restartCore } = await import('../core/manager')
    const { getCoreState } = await import('../core/status')
    const state = getCoreState()
    if (state.status !== 'running') {
      await restartCore().catch(() => {})
    }
  } catch (e) {
    console.warn('[Zapret] Core recovery error on stop:', e)
  }

  return { success: true }
}

export async function startZapret(strategyName?: string): Promise<{ success: boolean; strategy: string }> {
  const zapretDir = getZapretDir()
  const binDir = getZapretBinDir()
  const winwsExe = getZapretWinws()

  if (!existsSync(winwsExe)) {
    throw new Error('Zapret не установлен. Нажмите кнопку "Скачать Zapret".')
  }

  // 1. Stop Mihomo core & disable system proxy for mutually exclusive operation
  try {
    const { patchControledMihomoConfig } = await import('../config/controledMihomo')
    const { patchAppConfig } = await import('../config/app')
    await patchControledMihomoConfig({ tun: { enable: false } }).catch(() => {})
    await patchAppConfig({ proxyMode: false }).catch(() => {})
  } catch {}
  try {
    const { triggerSysProxy } = await import('../sys/sysproxy')
    await triggerSysProxy(false, false).catch(() => {})
  } catch (e) {
    console.warn('[Zapret] Disable sysproxy warning:', e)
  }
  try {
    const { stopCore } = await import('../core/manager')
    await stopCore().catch(() => {})
  } catch (e) {
    console.warn('[Zapret] Stop core warning:', e)
  }
  try {
    const { safeSend } = await import('../utils/safeSend')
    safeSend(mainWindow, 'controledMihomoConfigUpdated')
    safeSend(mainWindow, 'appConfigUpdated')
  } catch {}

  // 2. Kill existing winws.exe
  await stopZapretProcess()

  // 3. Find strategy file
  const availableStrategies = getAvailableStrategies()
  const strategy = strategyName && availableStrategies.includes(strategyName)
    ? strategyName
    : (availableStrategies.find((s) => s === 'general.bat') || availableStrategies[0] || 'general.bat')

  const batPath = path.join(zapretDir, strategy)
  if (!existsSync(batPath)) {
    throw new Error(`Стратегия ${strategy} не найдена`)
  }

  const batContent = await readFile(batPath, 'utf-8')
  const rawArgs = extractWinwsArgs(batContent, zapretDir)
  if (!rawArgs) {
    throw new Error(`Не удалось прочитать параметры winws.exe из ${strategy}`)
  }

  // 4. Create runner script in zapretDir
  const runnerPath = path.join(zapretDir, 'uzurnet_runner.cmd')
  const runnerScript = `@echo off
chcp 65001 > nul
cd /d "${binDir}"
netsh interface tcp set global timestamps=enabled > nul 2>&1
"${winwsExe}" ${rawArgs}
`
  await writeFile(runnerPath, runnerScript, 'utf-8')

  // 5. Launch with administrator elevation hidden
  await execFilePromise('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Start-Process -FilePath "cmd.exe" -ArgumentList '/c', "\`"${runnerPath}\`"" -Verb RunAs -WindowStyle Hidden`
  ])

  // Give winws.exe a moment to initialize
  await new Promise((r) => setTimeout(r, 1200))
  const running = await isZapretRunning()

  await saveZapretMeta({ activeStrategy: strategy, selectedStrategy: strategy })

  mainWindow?.webContents.send('zapret-status-change', {
    status: running ? 'running' : 'failed',
    running,
    strategy
  })

  return { success: running, strategy }
}

export interface CustomServiceEndpoint {
  id: string
  name: string
  url: string
}

export interface CustomServiceCheckResult {
  id: string
  name: string
  url: string
  ok: boolean
  status?: number
  latencyMs?: number
  error?: string
}

export async function checkCustomEndpoints(
  endpoints: CustomServiceEndpoint[],
  timeout = 4000
): Promise<CustomServiceCheckResult[]> {
  return Promise.all(
    endpoints.map(async (ep) => {
      const startTime = Date.now()
      try {
        let testUrl = ep.url.trim()
        if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
          testUrl = `https://${testUrl}`
        }
        const res = await axios.get(testUrl, {
          timeout,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 500
        })
        const latencyMs = Date.now() - startTime
        return {
          id: ep.id,
          name: ep.name,
          url: testUrl,
          ok: res.status >= 200 && res.status < 500,
          status: res.status,
          latencyMs
        }
      } catch (e) {
        return {
          id: ep.id,
          name: ep.name,
          url: ep.url,
          ok: false,
          latencyMs: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e)
        }
      }
    })
  )
}

export async function checkZapretServices(timeout = 4000): Promise<ZapretServiceCheckResult> {
  const checkEndpoint = async (url: string, to = timeout): Promise<boolean> => {
    try {
      const res = await axios.get(url, {
        timeout: to,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 500
      })
      return res.status >= 200 && res.status < 500
    } catch {
      return false
    }
  }

  const [youtubeWeb, youtubeVideo, discordWeb, discordGateway] = await Promise.all([
    checkEndpoint('https://www.youtube.com'),
    checkEndpoint('https://redirector.googlevideo.com/report_mapping'),
    checkEndpoint('https://discord.com'),
    checkEndpoint('https://gateway.discord.gg')
  ])

  return {
    youtube: youtubeWeb || youtubeVideo,
    discord: discordWeb || discordGateway,
    details: {
      youtubeWeb,
      youtubeVideo,
      discordWeb,
      discordGateway
    },
    timestamp: Date.now()
  }
}

export async function autoSelectZapretStrategy(): Promise<{
  success: boolean
  strategy?: string
  score?: number
  details?: ZapretServiceCheckResult
  message?: string
}> {
  const status = await getZapretStatus()
  if (!status.installed) {
    throw new Error('Zapret не установлен. Сначала скачайте его.')
  }

  const allStrategies = getAvailableStrategies()
  if (allStrategies.length === 0) {
    throw new Error('Стратегии не найдены в папке Zapret.')
  }

  const priorityList = [
    'general.bat',
    'general (ALT).bat',
    'general (ALT2).bat',
    'general (ALT3).bat',
    'general (FAKE TLS AUTO).bat',
    'general (FAKE TLS AUTO ALT).bat',
    'general (ALT4).bat',
    'general (ALT5).bat',
    'general (ALT6).bat',
    'general (ALT7).bat',
    'general (ALT8).bat',
    'general (SIMPLE FAKE).bat'
  ]

  const candidates = [
    ...priorityList.filter((p) => allStrategies.includes(p)),
    ...allStrategies.filter((s) => !priorityList.includes(s))
  ]

  let bestStrategy = ''
  let bestScore = -1
  let bestResult: ZapretServiceCheckResult | null = null

  for (let i = 0; i < candidates.length; i++) {
    const strat = candidates[i]
    mainWindow?.webContents.send('zapret-autoselect-progress', {
      strategy: strat,
      index: i + 1,
      total: candidates.length
    })

    try {
      await startZapret(strat)
      // Wait 1.6s for winws & WinDivert to bind
      await new Promise((r) => setTimeout(r, 1600))
      const checkRes = await checkZapretServices(3500)

      let score = 0
      if (checkRes.details.youtubeVideo) score += 3
      if (checkRes.details.youtubeWeb) score += 1
      if (checkRes.details.discordGateway) score += 3
      if (checkRes.details.discordWeb) score += 1

      if (score > bestScore) {
        bestScore = score
        bestStrategy = strat
        bestResult = checkRes
      }

      // If both YouTube video & Discord gateway pass, we found a perfect strategy!
      if (checkRes.details.youtubeVideo && checkRes.details.discordGateway) {
        mainWindow?.webContents.send('zapret-autoselect-complete', {
          success: true,
          strategy: strat,
          score,
          details: checkRes
        })
        return {
          success: true,
          strategy: strat,
          score,
          details: checkRes
        }
      }
    } catch (err) {
      console.warn(`[Zapret AutoSelect] Strategy ${strat} failed:`, err)
    }
  }

  // If we found a strategy that partially or fully works
  if (bestScore > 0 && bestStrategy) {
    await startZapret(bestStrategy)
    mainWindow?.webContents.send('zapret-autoselect-complete', {
      success: true,
      strategy: bestStrategy,
      score: bestScore,
      details: bestResult ?? undefined
    })
    return {
      success: true,
      strategy: bestStrategy,
      score: bestScore,
      details: bestResult ?? undefined
    }
  }

  mainWindow?.webContents.send('zapret-autoselect-complete', {
    success: false,
    message: 'Не удалось подобрать рабочую стратегию. Попробуйте обновить hosts-файл.'
  })

  return {
    success: false,
    message: 'Не удалось подобрать рабочую стратегию. Попробуйте обновить hosts-файл.'
  }
}

export async function applyZapretHosts(): Promise<{ success: boolean }> {
  if (process.platform !== 'win32') return { success: false }

  // 1. Fetch latest hosts from Flowseal repo
  const res = await axios.get(
    'https://raw.githubusercontent.com/Flowseal/zapret-discord-youtube/refs/heads/main/.service/hosts',
    { timeout: 10000 }
  )
  const remoteHostsContent = (res.data as string).trim()

  // 2. Read existing hosts file
  let currentHosts = ''
  if (existsSync(HOSTS_PATH)) {
    currentHosts = await readFile(HOSTS_PATH, 'utf-8')
  }

  // 3. Strip existing UzurNet Zapret block
  const cleanRegex = new RegExp(`\r?\n?${HOSTS_START_TAG}[\\s\\S]*?${HOSTS_END_TAG}\r?\n?`, 'g')
  const baseHosts = currentHosts.replace(cleanRegex, '').trim()

  // 4. Construct new hosts content
  const newHosts = `${baseHosts}\r\n\r\n${HOSTS_START_TAG}\r\n# Flowseal zapret-discord-youtube Discord & YouTube Fix\r\n${remoteHostsContent}\r\n${HOSTS_END_TAG}\r\n`

  // 5. Write to temp file and elevated copy
  const tempFile = path.join(dataDir(), 'temp_zapret_hosts.txt')
  await writeFile(tempFile, newHosts, 'utf-8')

  try {
    await execFilePromise('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `& { $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "copy /y \`"${tempFile}\`" \`"${HOSTS_PATH}\`" & ipconfig /flushdns" -Verb RunAs -WindowStyle Hidden -PassThru -Wait; exit $p.ExitCode }`
    ])
    return { success: true }
  } finally {
    try {
      if (existsSync(tempFile)) await rm(tempFile, { force: true })
    } catch {}
  }
}

export async function removeZapretHosts(): Promise<{ success: boolean }> {
  if (process.platform !== 'win32' || !existsSync(HOSTS_PATH)) return { success: true }

  const currentHosts = await readFile(HOSTS_PATH, 'utf-8')
  const cleanRegex = new RegExp(`\r?\n?${HOSTS_START_TAG}[\\s\\S]*?${HOSTS_END_TAG}\r?\n?`, 'g')
  const newHosts = currentHosts.replace(cleanRegex, '').trim() + '\r\n'

  const tempFile = path.join(dataDir(), 'temp_zapret_hosts.txt')
  await writeFile(tempFile, newHosts, 'utf-8')

  try {
    await execFilePromise('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `& { $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "copy /y \`"${tempFile}\`" \`"${HOSTS_PATH}\`" & ipconfig /flushdns" -Verb RunAs -WindowStyle Hidden -PassThru -Wait; exit $p.ExitCode }`
    ])
    return { success: true }
  } finally {
    try {
      if (existsSync(tempFile)) await rm(tempFile, { force: true })
    } catch {}
  }
}
