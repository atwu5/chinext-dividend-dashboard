/**
 * 日期工具：所有日期字符串均为 YYYY-MM-DD（东八区业务日期）。
 * 内部统一按 UTC 处理，避免时区偏移造成日期漂移。
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

export function shiftDays(s: string, days: number): string {
  const d = parseDate(s)
  d.setUTCDate(d.getUTCDate() + days)
  return fmtDate(d)
}

/** 平移 N 年（2月29日自动收敛到当月最后一天） */
export function shiftYears(s: string, years: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const ny = y + years
  const lastDay = new Date(Date.UTC(ny, m, 0)).getUTCDate()
  return `${ny}-${pad2(m)}-${pad2(Math.min(d, lastDay))}`
}

export function laterDate(a: string, b: string): string {
  return a > b ? a : b
}

export interface BjNow {
  date: string
  weekday: number // 0=周日 … 6=周六
  hour: number
  minute: number
}

/** 用 Asia/Shanghai 时区取当前业务时间（GitHub Actions 运行在 UTC，必须显式换算） */
export function beijingNow(): BjNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: weekdayMap[get('weekday')] ?? 0,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  }
}

/**
 * 当前允许接受的最大交易日期（业务日期基准 = 北京时间）：
 * - 工作日 15:05 之后 → 当天（收盘数据已可用）
 * - 其余情况 → 上一个工作日（周末 / 节假日 / 盘中运行时，保留上一有效交易日数据）
 * 法定节假日由数据源实际返回决定：即使函数放行了某天，数据源没有当日数据就不会写入。
 */
export function maxAcceptDate(): string {
  const now = beijingNow()
  const afterClose = now.weekday >= 1 && now.weekday <= 5 && (now.hour > 15 || (now.hour === 15 && now.minute >= 5))
  if (afterClose) return now.date
  let cursor = now.date
  for (let i = 0; i < 7; i += 1) {
    const weekday = parseDate(cursor).getUTCDay()
    if (weekday >= 1 && weekday <= 5) return cursor
    cursor = shiftDays(cursor, -1)
  }
  return cursor
}
