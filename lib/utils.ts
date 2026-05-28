export function getKSTDateString(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

export function formatKSTTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '--:--'
  const d = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = kst.getUTCHours().toString().padStart(2, '0')
  const m = kst.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
