import type { DailyRecord, Metadata } from '../../../shared/types'

export class DataVersionMismatchError extends Error {
  constructor() {
    super('metadata 与 historical 数据版本不一致，请点击「刷新数据」重试')
    this.name = 'DataVersionMismatchError'
  }
}

export interface DashboardData {
  meta: Metadata
  records: DailyRecord[]
}

let cache: DashboardData | null = null

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url.replace(location.origin, '')}`)
  return (await res.json()) as T
}

/**
 * 访问流程（对应需求 4.6）：
 * 1. no-store 请求 metadata.json 判断数据版本（附带时间戳参数兜底防缓存）
 * 2. 按「?v=版本」加载 historical.json（浏览器可长期缓存；部署新数据后版本号变化 → URL 变化 → 缓存自动失效）
 * 3. 校验 metadata 与 historical 的一致性（条数 + 最新日期），不一致视为版本错误并提示刷新
 * 4. 数据保存在页面运行内存（模块级缓存）中，图表切换 / 缩放 / 拖动均不重新请求行情接口
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const base = import.meta.env.BASE_URL ?? './'
  const meta = await getJson<Metadata>(`${base}data/metadata.json?t=${Date.now()}`, { cache: 'no-store' })
  const records = await getJson<DailyRecord[]>(`${base}data/historical.json?v=${meta.version}`)
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('历史行情文件为空或格式错误')
  }
  if (meta.count !== records.length || meta.lastDate !== records[records.length - 1].date) {
    throw new DataVersionMismatchError()
  }
  return { meta, records }
}

export function cachedDashboardData(): DashboardData | null {
  return cache
}

export function setCachedDashboardData(data: DashboardData): void {
  cache = data
}
