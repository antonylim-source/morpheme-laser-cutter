/**
 * 몬스터 시퀀스 시트 리사이즈 — 접근 75%, success 85%
 * 사용: node scripts/resize-monster-sequences.mjs
 */
import sharp from 'sharp'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const imagesDir = join(__dirname, '..', 'public', 'images')

/** @type {Record<string, { scale: number, frameW: number, frameH: number, cols?: number, rows?: number }>} */
const TARGETS = {
  'monster_4-sequence.png': { scale: 0.75, frameW: 498, frameH: 289 },
  'monster_1-sequence.png': { scale: 0.75, frameW: 486, frameH: 323 },
  'monster_3-sequence.png': { scale: 0.75, frameW: 575, frameH: 357 },
  'monster_2-sequence.png': { scale: 0.75, frameW: 520, frameH: 329 },
  'monster_4_success.png': { scale: 0.85, frameW: 734, frameH: 408 },
  'monster_1_success.png': { scale: 0.85, frameW: 734, frameH: 408 },
  'monster_3_success.png': { scale: 0.85, frameW: 734, frameH: 408 },
  'monster_2_success.png': { scale: 0.85, frameW: 734, frameH: 382 },
}

const pngOpts = { compressionLevel: 9, palette: true, quality: 85, effort: 10 }

let saved = 0

for (const [name, cfg] of Object.entries(TARGETS)) {
  const cols = cfg.cols ?? 6
  const rows = cfg.rows ?? 6
  const targetW = cols * cfg.frameW
  const targetH = rows * cfg.frameH
  const absPath = join(imagesDir, name)
  const before = statSync(absPath).size
  const input = readFileSync(absPath)

  const buf = await sharp(input)
    .resize(targetW, targetH, { fit: 'fill' })
    .png(pngOpts)
    .toBuffer()

  const meta = await sharp(buf).metadata()
  if (meta.width !== targetW || meta.height !== targetH) {
    console.error(`크기 불일치: ${name} → ${meta.width}x${meta.height}, 기대 ${targetW}x${targetH}`)
    continue
  }

  writeFileSync(absPath, buf)
  saved += before - buf.length
  console.log(
    `${name}: ${cfg.frameW}x${cfg.frameH}/frame, ${targetW}x${targetH} — ${Math.round(before / 1024)}KB → ${Math.round(buf.length / 1024)}KB`,
  )
}

console.log(`\n총 절약: ${Math.round(saved / 1024)}KB (${(saved / 1024 / 1024).toFixed(2)}MB)`)
