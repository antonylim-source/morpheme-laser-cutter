/** public/ 폴더 기준 경로 (GitHub Pages base URL 반영) */
export function publicAsset(path: string): string {
  const normalized = path.replace(/^\//, '')
  return `${import.meta.env.BASE_URL}${normalized}`
}
