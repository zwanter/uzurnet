export function detectCountryCode(rawName: string): string {
  const original = String(rawName || '')

  // 1. If regional indicator flags are present, extract ISO country code mathematically
  const regChars = [...original].filter(
    (c) => c.codePointAt(0)! >= 0x1f1e6 && c.codePointAt(0)! <= 0x1f1ff
  )
  if (regChars.length >= 2) {
    const code = regChars
      .slice(0, 2)
      .map((c) => String.fromCharCode(c.codePointAt(0)! - 0x1f1e6 + 65))
      .join('')
    if (code.length === 2) return code
  }

  const n = original.toLowerCase()
  if (n.includes('nl') || n.includes('netherland') || n.includes('нидерланд') || n.includes('амстердам')) return 'NL'
  if (n.includes('de') || n.includes('germany') || n.includes('германи') || n.includes('франкфурт') || n.includes('берлин')) return 'DE'
  if (n.includes('fr') || n.includes('france') || n.includes('франци') || n.includes('париж')) return 'FR'
  if (n.includes('gb') || n.includes('uk') || n.includes('london') || n.includes('британи') || n.includes('лондон') || n.includes('англи')) return 'GB'
  if (
    n.includes('us') ||
    n.includes('usa') ||
    n.includes('united states') ||
    n.includes('сша') ||
    n.includes('америк') ||
    n.includes('виргини') ||
    n.includes('нью-йорк') ||
    n.includes('калифорни') ||
    n.includes('маймами') ||
    n.includes('лос-анджелес')
  ) {
    return 'US'
  }
  if (n.includes('fi') || n.includes('finland') || n.includes('финлянд') || n.includes('хельсинк')) return 'FI'
  if (n.includes('se') || n.includes('sweden') || n.includes('швеци') || n.includes('стокгольм')) return 'SE'
  if (n.includes('pl') || n.includes('poland') || n.includes('польш') || n.includes('варшав')) return 'PL'
  if (n.includes('ee') || n.includes('estonia') || n.includes('эстони') || n.includes('таллин')) return 'EE'
  if (n.includes('at') || n.includes('austria') || n.includes('австри') || n.includes('вен')) return 'AT'
  if (n.includes('tr') || n.includes('turkey') || n.includes('турци') || n.includes('стамбул')) return 'TR'
  if (n.includes('ru') || n.includes('russia') || n.includes('росси') || n.includes('москв')) return 'RU'
  if (n.includes('ua') || n.includes('ukraine') || n.includes('украин') || n.includes('киев')) return 'UA'
  if (n.includes('kz') || n.includes('kazakhstan') || n.includes('казахстан') || n.includes('алмат') || n.includes('астан')) return 'KZ'
  if (n.includes('ch') || n.includes('switzerland') || n.includes('швейцар')) return 'CH'
  if (n.includes('jp') || n.includes('japan') || n.includes('япони') || n.includes('токио')) return 'JP'
  if (n.includes('sg') || n.includes('singapore') || n.includes('сингапур')) return 'SG'
  if (n.includes('ca') || n.includes('canada') || n.includes('канад')) return 'CA'
  return ''
}

export function parseServerNode(rawName: unknown) {
  const original =
    typeof rawName === 'string'
      ? rawName
      : typeof (rawName as any)?.name === 'string'
        ? (rawName as any).name
        : String(rawName || '')

  const countryCode = detectCountryCode(original)

  let clean = (original || '').trim()

  // 1. Remove Regional Indicator symbols (flag emojis) \u{1F1E6}-\u{1F1FF}
  clean = clean.replace(/[\u{1F1E6}-\u{1F1FF}]{1,2}/gu, '').trim()

  // 2. Remove leading emoji like lightning, rockets, stars, circles
  clean = clean.replace(/^[⚡\u26A1\uFE0F🚀⭐️✨🔥🌐🛸\-_*\s]+/u, '').trim()

  // Check if country code prefix had a superscript or digit (e.g. GB², FI¹, SE³, DE²)
  let superscript = ''
  const matchSup = clean.match(/^[A-Za-z]{2}([¹²³⁴⁵⁶⁷⁸⁹0-9])/)
  if (matchSup) {
    superscript = matchSup[1]
  }

  // 3. Remove 2-letter country code prefix (e.g. 'GB ', 'GB² ', 'FI¹ ', 'AT ', 'FR ', 'SE² ', 'DE¹ ', 'us ')
  clean = clean.replace(/^[A-Za-z]{2}[¹²³⁴⁵⁶⁷⁸⁹0-9]?(\s*[-—–|:•/⚡\u26A1\uFE0F]\s*|\s+)/iu, '').trim()
  // Repeat to strip duplicate prefixes (e.g. 'GB GB ')
  clean = clean.replace(/^[A-Za-z]{2}[¹²³⁴⁵⁶⁷⁸⁹0-9]?(\s*[-—–|:•/⚡\u26A1\uFE0F]\s*|\s+)/iu, '').trim()

  // 4. Remove any remaining leading lightning or delimiters
  clean = clean.replace(/^[⚡\u26A1\uFE0F🚀⭐️✨🔥🌐🛸\-_*|/\\#:•\s]+/u, '').trim()

  // If the country prefix had a superscript index and the cleaned name doesn't already have one, append it
  if (superscript && !clean.includes(superscript)) {
    clean = `${clean}${superscript}`
  }

  if (!clean) clean = original

  return {
    countryCode,
    displayName: clean,
    originalName: original
  }
}

export function getPingClass(delay: number): string {
  if (delay === 0) {
    // Distinct crimson red for timeouts
    return 'ping-timeout'
  }
  if (delay === -1) {
    // Neutral glass when not tested
    return 'ping-none'
  }
  if (delay < 120) {
    // Emerald green (< 120 ms)
    return 'ping-fast'
  }
  if (delay < 250) {
    // Cyan blue (120 - 250 ms)
    return 'ping-good'
  }
  if (delay < 450) {
    // Warm golden amber (250 - 450 ms)
    return 'ping-medium'
  }
  // Coral / orange (> 450 ms) — distinct from timeout red!
  return 'ping-high'
}
