// 일회성 도구: 이미지 테두리에서 연결된 흰 배경만 투명 처리 (내부 흰색은 보존)
// 사용: node scripts/remove-white-bg.mjs <png 경로...>
import fs from 'node:fs'
import { PNG } from 'pngjs'

const FILL_THRESHOLD = 235 // 이 값 이상으로 밝으면 배경 후보
const FEATHER_MIN = 200 // 경계 페더링 시작 밝기

function processFile(path) {
  const png = PNG.sync.read(fs.readFileSync(path))
  const { width, height, data } = png

  const idx = (x, y) => (y * width + x) * 4
  const minChannel = (i) => Math.min(data[i], data[i + 1], data[i + 2])
  const isBgCandidate = (i) => data[i + 3] > 0 && minChannel(i) >= FILL_THRESHOLD

  // 1) 테두리에서 시작하는 BFS 플러드필
  const bg = new Uint8Array(width * height)
  const queue = []
  const push = (x, y) => {
    const p = y * width + x
    if (bg[p]) return
    if (!isBgCandidate(p * 4)) return
    bg[p] = 1
    queue.push(p)
  }
  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }
  while (queue.length > 0) {
    const p = queue.pop()
    const x = p % width
    const y = (p / width) | 0
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }

  // 2) 배경 투명화 + 경계 페더링(흰 기운이 남은 가장자리 픽셀은 부분 투명)
  let removed = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const i = p * 4
      if (bg[p]) {
        data[i + 3] = 0
        removed++
        continue
      }
      const nearBg =
        (x > 0 && bg[p - 1]) ||
        (x < width - 1 && bg[p + 1]) ||
        (y > 0 && bg[p - width]) ||
        (y < height - 1 && bg[p + width])
      if (nearBg) {
        const m = minChannel(i)
        if (m >= FEATHER_MIN) {
          const t = (m - FEATHER_MIN) / (255 - FEATHER_MIN)
          data[i + 3] = Math.min(data[i + 3], Math.round(255 * (1 - t * 0.85)))
        }
      }
    }
  }

  fs.writeFileSync(path, PNG.sync.write(png))
  const pct = ((removed / (width * height)) * 100).toFixed(1)
  console.log(`${path}: ${width}x${height}, background removed ${pct}%`)
}

for (const file of process.argv.slice(2)) {
  processFile(file)
}
