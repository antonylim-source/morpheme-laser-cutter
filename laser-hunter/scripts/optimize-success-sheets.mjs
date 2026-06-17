/**
 * monster_*_success.png 스프라이트 시트 최적화 (해상도 유지, PNG 팔레트 압축)
 * 사용: node scripts/optimize-success-sheets.mjs
 */
import sharp from 'sharp'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const imagesDir = join(__dirname, '..', 'public', 'images')

const FILES = [
  'monster_1_success.png',
  'monster_2_success.png',
  'monster_3_success.png',
  'monster_4_success.png',
]

const pngOpts = {
  compressionLevel: 9,
  palette: true,
  quality: 85,
  effort: 10,
}

let saved = 0

for (const name of FILES) {
  const absPath = join(imagesDir, name)
  const before = statSync(absPath).size
  const input = readFileSync(absPath)
  const metaBefore = await sharp(input).metadata()

  const buf = await sharp(input).png(pngOpts).toBuffer()
  const metaAfter = await sharp(buf).metadata()

  if (metaAfter.width !== metaBefore.width || metaAfter.height !== metaBefore.height) {
    console.error(`건너뜀 (해상도 변경): ${name}`)
    continue
  }

  if (buf.length >= before) {
    console.log(`유지: ${name} (${Math.round(before / 1024)}KB)`)
    continue
  }

  writeFileSync(absPath, buf)
  saved += before - buf.length
  console.log(
    `${name}: ${metaBefore.width}x${metaBefore.height} — ${Math.round(before / 1024)}KB → ${Math.round(buf.length / 1024)}KB (-${Math.round((before - buf.length) / 1024)}KB)`,
  )
}

console.log(`\n총 절약: ${Math.round(saved / 1024)}KB (${(saved / 1024 / 1024).toFixed(1)}MB)`)
