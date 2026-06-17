/**
 * public/images PNG 일괄 최적화 (용량·해상도)
 * 사용: node scripts/optimize-images.mjs
 */
import sharp from 'sharp'
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const imagesDir = join(root, 'public', 'images')
const publicDir = join(root, 'public')

const MORPHEME_RE = /^[a-z]+\.png$/
const MONSTER_STATIC_RE = /^monster_[1-4]\.png$/

const DELETE_PATHS = [
  join(imagesDir, 'bg_img--.png'),
  join(imagesDir, 'monster_3-sequence..png'),
  join(root, 'src', 'assets', 'progress', 'progress_area.png'),
  join(root, 'src', 'assets', 'hero.png'),
]

const pngPalette = (quality = 90) => ({
  compressionLevel: 9,
  palette: true,
  quality,
  effort: 10,
})

async function optimizeFile(absPath, rule) {
  const before = statSync(absPath).size
  let pipeline = sharp(readFileSync(absPath))

  if (rule.resize) {
    pipeline = pipeline.resize(rule.resize)
  }

  const buf = await pipeline.png(rule.png ?? { compressionLevel: 9 }).toBuffer()
  if (buf.length >= before) {
    return { rel: relative(root, absPath), before, after: before, skipped: true }
  }

  writeFileSync(absPath, buf)
  return { rel: relative(root, absPath), before, after: buf.length, skipped: false }
}

function collectPngFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) collectPngFiles(abs, acc)
    else if (entry.name.endsWith('.png')) acc.push(abs)
  }
  return acc
}

function ruleFor(absPath) {
  const rel = relative(imagesDir, absPath).replace(/\\/g, '/')
  const base = rel.split('/').pop()

  if (base === 'bg_img.png') {
    return { resize: { width: 1920, withoutEnlargement: true }, png: pngPalette(85) }
  }
  if (base === 'title_log.png') {
    return { resize: { width: 800, withoutEnlargement: true }, png: pngPalette(90) }
  }
  if (base === 'progress_area.png') {
    return { png: pngPalette(90) }
  }
  if (base.endsWith('-sequence.png')) {
    return { png: pngPalette(90) }
  }
  if (/^monster_[1-4]_success\.png$/.test(base)) {
    return { png: pngPalette(85) }
  }
  if (MONSTER_STATIC_RE.test(base)) {
    return { png: pngPalette(90) }
  }
  if (rel.startsWith('ui/')) {
    return {
      resize: { width: 96, height: 96, fit: 'inside', withoutEnlargement: true },
      png: pngPalette(92),
    }
  }
  if (MORPHEME_RE.test(base)) {
    return { png: pngPalette(92) }
  }
  return { png: { compressionLevel: 9 } }
}

function ruleForPublic(absPath) {
  const base = relative(publicDir, absPath)
  if (base === 'favicon.png') {
    return {
      resize: { width: 64, height: 64, fit: 'cover', withoutEnlargement: true },
      png: pngPalette(90),
    }
  }
  return null
}

let deleted = 0
for (const p of DELETE_PATHS) {
  try {
    unlinkSync(p)
    console.log(`삭제: ${relative(root, p)}`)
    deleted++
  } catch {
    /* 없으면 무시 */
  }
}

const targets = [...collectPngFiles(imagesDir), join(publicDir, 'favicon.png')].filter((p) => {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
})

let saved = 0
let optimized = 0
let skipped = 0

for (const absPath of targets) {
  const rule = ruleForPublic(absPath) ?? ruleFor(absPath)
  if (!rule) continue

  const result = await optimizeFile(absPath, rule)
  if (result.skipped) {
    skipped++
    console.log(`유지: ${result.rel} (${Math.round(result.before / 1024)}KB)`)
  } else {
    optimized++
    const delta = result.before - result.after
    saved += delta
    console.log(
      `최적화: ${result.rel} ${Math.round(result.before / 1024)}KB → ${Math.round(result.after / 1024)}KB (-${Math.round(delta / 1024)}KB)`,
    )
  }
}

console.log(
  `\n완료 — 삭제 ${deleted}개, 최적화 ${optimized}개, 유지 ${skipped}개, 절약 ${Math.round(saved / 1024)}KB`,
)
