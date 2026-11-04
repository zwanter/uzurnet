import yaml from 'yaml'
import { readFileSync, writeFileSync } from 'fs'
import { extractVersionSection } from './changelog.mjs'

const pkg = readFileSync('package.json', 'utf-8')
const rawChangelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)

let changelog = extractVersionSection(rawChangelog, version)
const tag = version.startsWith('v') ? version : `v${version}`
const downloadUrl = `https://github.com/zwanter/uzurnet/releases/download/${tag}`

const badge = (format, label, logo) =>
  `https://img.shields.io/badge/${format}-default?style=flat&logo=${logo}&label=${encodeURIComponent(label)}`

const link = (url, format, label, logo) =>
  `<a href="${url}"><img src="${badge(format, label, logo)}"></a>`

if (process.env.SKIP_CHANGELOG !== '1') {
  changelog += '\n### Ссылки для скачивания:\n\n#### Windows 10/11 (64-bit):\n\n'
  changelog += link(`${downloadUrl}/UzurNet_x64-setup.exe`, 'EXE', 'Установщик (64-bit)', 'windows') + ' '
  changelog += link(`${downloadUrl}/UzurNet_x64-portable.7z`, '7Z', 'Портативная версия (64-bit)', 'windows') + '\n\n'
}

const latest = {
  version,
  changelog
}

writeFileSync('latest.yml', yaml.stringify(latest))
writeFileSync('changelog.md', changelog)
