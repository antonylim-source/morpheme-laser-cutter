import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'images')
mkdirSync(outDir, { recursive: true })

/** @type {Record<string, { emoji: string; bg: string; accent: string }>} */
const morphemes = {
  rain: { emoji: '🌧️', bg: '#1e3a5f', accent: '#38bdf8' },
  coat: { emoji: '🧥', bg: '#3b2f4a', accent: '#a78bfa' },
  sun: { emoji: '☀️', bg: '#713f12', accent: '#fbbf24' },
  burn: { emoji: '🔥', bg: '#7f1d1d', accent: '#f87171' },
  foot: { emoji: '🦶', bg: '#44403c', accent: '#d6d3d1' },
  ball: { emoji: '⚽', bg: '#14532d', accent: '#4ade80' },
  bed: { emoji: '🛏️', bg: '#312e81', accent: '#818cf8' },
  room: { emoji: '🚪', bg: '#1e293b', accent: '#94a3b8' },
  tooth: { emoji: '🦷', bg: '#ecfdf5', accent: '#6ee7b7' },
  brush: { emoji: '🪥', bg: '#0c4a6e', accent: '#7dd3fc' },
  play: { emoji: '🎮', bg: '#581c87', accent: '#e879f9' },
  ground: { emoji: '🌍', bg: '#365314', accent: '#a3e635' },
  book: { emoji: '📚', bg: '#78350f', accent: '#fdba74' },
  case: { emoji: '📦', bg: '#422006', accent: '#fcd34d' },
  sea: { emoji: '🌊', bg: '#0c4a6e', accent: '#22d3ee' },
  shore: { emoji: '🏖️', bg: '#ca8a04', accent: '#fef08a' },
  door: { emoji: '🚪', bg: '#44403c', accent: '#fcd34d' },
  bell: { emoji: '🔔', bg: '#854d0e', accent: '#fde047' },
  water: { emoji: '💧', bg: '#075985', accent: '#38bdf8' },
  fall: { emoji: '🍂', bg: '#9a3412', accent: '#fb923c' },
  earth: { emoji: '🌍', bg: '#1d4ed8', accent: '#60a5fa' },
  quake: { emoji: '💥', bg: '#7c2d12', accent: '#fb7185' },
}

function morphemeSvg(name, { emoji, bg, accent }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${bg}"/>
    </radialGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#g)"/>
  <rect x="8" y="8" width="112" height="112" rx="20" fill="none" stroke="${accent}" stroke-width="3" opacity="0.6"/>
  <text x="64" y="78" text-anchor="middle" font-size="52">${emoji}</text>
  <text x="64" y="112" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#f8fafc" opacity="0.9">${name}</text>
</svg>`
}

function combinedSvg(name, m1, m2) {
  const a = morphemes[m1]
  const b = morphemes[m2]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120">
  <defs>
    <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9a3412"/>
      <stop offset="100%" stop-color="#431407"/>
    </linearGradient>
  </defs>
  <rect x="4" y="12" width="312" height="96" rx="28" fill="url(#rock)" stroke="#292524" stroke-width="3"/>
  ${Array.from({ length: 8 }).map((_, i) => {
    const x = 24 + i * 36
    return `<path d="M${x} 28 L${x + 10} 36 L${x + 4} 52" fill="none" stroke="#292524" stroke-width="2" opacity="0.5"/>`
  }).join('')}
  <circle cx="90" cy="60" r="28" fill="${a.bg}" stroke="${a.accent}" stroke-width="2"/>
  <text x="90" y="70" text-anchor="middle" font-size="32">${a.emoji}</text>
  <circle cx="230" cy="60" r="28" fill="${b.bg}" stroke="${b.accent}" stroke-width="2"/>
  <text x="230" y="70" text-anchor="middle" font-size="32">${b.emoji}</text>
  <text x="160" y="68" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="22" font-weight="900" fill="#fef3c7" letter-spacing="2">${name.toUpperCase()}</text>
</svg>`
}

const compounds = [
  ['raincoat', 'rain', 'coat'],
  ['sunburn', 'sun', 'burn'],
  ['football', 'foot', 'ball'],
  ['bedroom', 'bed', 'room'],
  ['toothbrush', 'tooth', 'brush'],
  ['playground', 'play', 'ground'],
  ['bookcase', 'book', 'case'],
  ['seashore', 'sea', 'shore'],
  ['doorbell', 'door', 'bell'],
  ['waterfall', 'water', 'fall'],
  ['earthquake', 'earth', 'quake'],
]

for (const [name, cfg] of Object.entries(morphemes)) {
  writeFileSync(join(outDir, `${name}.svg`), morphemeSvg(name, cfg))
}

for (const [full, m1, m2] of compounds) {
  writeFileSync(join(outDir, `${full}.svg`), combinedSvg(full, m1, m2))
}

console.log(`Generated ${Object.keys(morphemes).length + compounds.length} SVG files in public/images/`)
