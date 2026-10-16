export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * ECharts 时间轴的时间戳（UTC 毫秒）→ YYYY-MM-DD。
 * 纯日期字符串（YYYY-MM-DD）按 ECMAScript 规范以 UTC 解析，
 * 因此这里必须用 UTC 取值，避免在非东八区设备上日期漂移一天。
 */
export function fmtDateUTC(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** ISO 时间 → 北京时间展示格式（用于 metadata 更新时间等） */
export function fmtDateTimeCn(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** 指数点位：千分位 + 2 位小数 */
export function fmtPoint(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 把日期字符串平移 N 年（2月29日自动收敛到当月最后一天），返回 YYYY-MM-DD */
export function shiftYearsISO(dateStr: string, years: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const ny = y + years
  const lastDay = new Date(Date.UTC(ny, m, 0)).getUTCDate()
  return `${ny}-${pad2(m)}-${pad2(Math.min(d, lastDay))}`
}

export function laterDate(a: string, b: string): string {
  return a > b ? a : b
}
