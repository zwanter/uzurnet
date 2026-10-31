import { copyFile, readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { themesDir } from '../utils/dirs'
import { t } from '../utils/i18n'
import path from 'path'
import axios from 'axios'
import https from 'https'
import AdmZip from 'adm-zip'
import { getRuntimeConfig } from '../core/factory'
import { existsSync } from 'fs'
import { mainWindow } from '..'
import { floatingWindow } from './floatingWindow'

let insertedCSSKeyMain: string | undefined = undefined
let insertedCSSKeyFloating: string | undefined = undefined

const BUILTIN_THEMES: Record<string, string> = {
  'cyber-neon.css': `/* Cyber Neon */
:root {
  --radius: 0.75rem;
}
.dark {
  --background: 240 10% 4%;
  --foreground: 0 0% 98%;
  --card: 240 10% 7%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 7%;
  --popover-foreground: 0 0% 98%;
  --primary: 263.4 90% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 6% 14%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 6% 16%;
  --muted-foreground: 240 5% 65%;
  --accent: 180 100% 50%;
  --accent-foreground: 240 10% 4%;
  --border: 240 6% 18%;
  --input: 240 6% 18%;
  --ring: 263.4 90% 60%;
}
.dark .card {
  box-shadow: 0 4px 20px -2px rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.25);
  transition: all 0.2s ease-in-out;
}
.dark .card:hover {
  border-color: rgba(124, 58, 237, 0.45);
}
`,
  'nordic-frost.css': `/* Nordic Frost */
:root {
  --radius: 0.75rem;
}
.dark {
  --background: 222 47% 7%;
  --foreground: 210 40% 98%;
  --card: 222 40% 10%;
  --card-foreground: 210 40% 98%;
  --popover: 222 40% 10%;
  --popover-foreground: 210 40% 98%;
  --primary: 199 89% 48%;
  --primary-foreground: 222 47% 11%;
  --secondary: 217 33% 18%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217 33% 18%;
  --muted-foreground: 215 20% 65%;
  --accent: 172 66% 50%;
  --accent-foreground: 222 47% 11%;
  --border: 217 33% 20%;
  --input: 217 33% 20%;
  --ring: 199 89% 48%;
}
.dark .card {
  box-shadow: 0 4px 20px -2px rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.25);
  transition: all 0.2s ease-in-out;
}
.dark .card:hover {
  border-color: rgba(14, 165, 233, 0.45);
}
`
}

export async function resolveThemes(): Promise<{ key: string; label: string }[]> {
  await mkdir(themesDir(), { recursive: true })
  for (const [filename, content] of Object.entries(BUILTIN_THEMES)) {
    const filePath = path.join(themesDir(), filename)
    if (!existsSync(filePath)) {
      await writeFile(filePath, content, 'utf-8').catch(() => {})
    }
  }
  const files = await readdir(themesDir())
  const themes = await Promise.all(
    files
      .filter((file) => file.endsWith('.css'))
      .map(async (file) => {
        const css = (await readFile(path.join(themesDir(), file), 'utf-8')) || ''
        let name = file
        if (css.startsWith('/*')) {
          name = css.split('\n')[0].replace('/*', '').replace('*/', '').trim() || file
        }
        return { key: file, label: name }
      })
  )
  if (themes.find((theme) => theme.key === 'default.css')) {
    return themes
  } else {
    return [{ key: 'default.css', label: t('ui.defaultTheme') }, ...themes]
  }
}

export async function fetchThemes(): Promise<void> {
  const zipUrl = 'https://github.com/mihomo-party-org/theme-hub/releases/download/latest/themes.zip'
  const { 'mixed-port': mixedPort = 0 } = (await getRuntimeConfig()) ?? {}
  const zipData = await axios.get(zipUrl, {
    responseType: 'arraybuffer',
    headers: { 'Content-Type': 'application/octet-stream' },
    ...(mixedPort != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    })
  })
  const zip = new AdmZip(zipData.data as Buffer)
  zip.extractAllTo(themesDir(), true)
}

export async function importThemes(files: string[]): Promise<void> {
  for (const file of files) {
    if (existsSync(file))
      await copyFile(
        file,
        path.join(themesDir(), `${new Date().getTime().toString(16)}-${path.basename(file)}`)
      )
  }
}

export async function readTheme(theme: string): Promise<string> {
  if (!existsSync(path.join(themesDir(), theme))) return ''
  return await readFile(path.join(themesDir(), theme), 'utf-8')
}

export async function writeTheme(theme: string, css: string): Promise<void> {
  await writeFile(path.join(themesDir(), theme), css)
}

export async function applyTheme(theme: string): Promise<void> {
  const css = await readTheme(theme)
  await mainWindow?.webContents.removeInsertedCSS(insertedCSSKeyMain || '')
  insertedCSSKeyMain = await mainWindow?.webContents.insertCSS(css)
  try {
    await floatingWindow?.webContents.removeInsertedCSS(insertedCSSKeyFloating || '')
    insertedCSSKeyFloating = await floatingWindow?.webContents.insertCSS(css)
  } catch {
    // ignore
  }
}

export async function downloadCustomCss(
  url: string,
  proxy?: { protocol: string; host: string; port: number },
  existingFile?: string
): Promise<string> {
  const httpsAgent = new https.Agent()
  const res = await axios.get(url, {
    httpsAgent,
    ...(proxy && { proxy }),
    responseType: 'text',
    timeout: 15000
  })
  const css = String(res.data)
  const label = new URL(url).pathname.split('/').pop()?.replace(/\.css$/i, '') || 'Custom Theme'
  const content = `/* ${label} */\n${css}`
  if (existingFile) {
    const existingPath = path.join(themesDir(), existingFile)
    if (existsSync(existingPath)) {
      const existing = await readFile(existingPath, 'utf-8')
      if (existing === content) return existingFile
    }
    await writeFile(path.join(themesDir(), existingFile), content, 'utf-8')
    return existingFile
  }
  const filename = `custom-${Date.now().toString(16)}.css`
  await writeFile(path.join(themesDir(), filename), content, 'utf-8')
  return filename
}
