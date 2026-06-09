import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = join(__dirname, '../public/images/title_log.png')

/** 체커보드(밝은 무채색) 픽셀을 투명 처리 */
function isCheckerboardBackground(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const avg = (r + g + b) / 3
  return chroma <= 10 && avg >= 188
}

const input = readFileSync(inputPath)
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += 4) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  if (isCheckerboardBackground(r, g, b)) {
    data[i + 3] = 0
  }
}

const output = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toBuffer()

writeFileSync(inputPath, output)
console.log(`Updated ${inputPath} (${info.width}x${info.height})`)
