import sharp from 'sharp'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const imagesDir = join(__dirname, '..', 'public', 'images')
const SIZE = 512

/** 검정/흰 배경을 투명 처리 */
function shouldBeTransparent(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const avg = (r + g + b) / 3
  if (max <= 28) return true
  if (chroma <= 12 && avg >= 235) return true
  if (chroma <= 8 && avg >= 200 && avg <= 234) return true
  return false
}

async function processFile(filename) {
  const inputPath = join(imagesDir, filename)
  const input = readFileSync(inputPath)
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (shouldBeTransparent(r, g, b)) {
      data[i + 3] = 0
    }
  }

  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 10 })
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer()

  writeFileSync(inputPath, trimmed)
  console.log(`Processed ${filename}`)
}

const files = readdirSync(imagesDir).filter((f) => /^[a-z]+\.png$/.test(f))
await Promise.all(files.map(processFile))
console.log(`Done: ${files.length} morpheme PNG(s)`)
