export function getKSTDateString(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

export function isOnLeaveOn(
  m: { vacationStart?: string | null; vacationEnd?: string | null; onLeave?: boolean },
  dateStr: string
): boolean {
  if (m.vacationStart && m.vacationEnd) {
    return dateStr >= m.vacationStart && dateStr <= m.vacationEnd
  }
  return !!m.onLeave // 레거시 폴백
}

// 오늘+13일까지 (오늘 포함 최대 14일) 종료일 상한 계산
export function maxVacationEnd(startStr: string): string {
  const d = new Date(startStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 13)
  return d.toISOString().split('T')[0]
}

export function formatKSTTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '--:--'
  const d = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const h = kst.getUTCHours().toString().padStart(2, '0')
  const m = kst.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
