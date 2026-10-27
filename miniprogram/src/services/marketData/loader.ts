import Taro from '@tarojs/taro'
import type { DailyRecord, Metadata } from '../../../../shared/types'
import { DATA_SOURCES } from '../../config'

export class DataVersionMismatchError extends Error {
  constructor() {
    super('metadata 与 historical 数据版本不一致，请刷新重试')
    this.name = 'DataVersionMismatchError'
  }
}

export interface DashboardData {
  meta: Metadata
  records: DailyRecord[]
}

let cache: DashboardData | null = null

/** 页面运行内存缓存：切页返回不重复请求，图表切换/缩放均不重新拉数据 */
export function cachedDashboardData(): DashboardData | null {
  return cache
}

export function setCachedDashboardData(data: DashboardData | null): void {
  cache = data
}

/**
 * 各平台请求失败时抛出的对象结构不同（如 { errMsg: 'request:fail ...' }），
 * 统一转成带具体原因的 Error，避免页面上显示 [object Object]。
 */
async function getJson<T>(base: string, path: string): Promise<T> {
  const url = `${base}${path}`
  const host = base.replace('https://', '').split('/')[0]
  let res: { statusCode: number; data: T }
  try {
    // 10s 超时兜底：网络挂起时进入下一数据源/错误态，绝不无限 loading
    res = await Taro.request<T>({ url, dataType: 'json', timeout: 10000 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as { errMsg?: string })?.errMsg || JSON.stringify(e))
    throw new Error(`${msg} · ${host}${path}`)
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`HTTP ${res.statusCode} · ${host}${path}`)
  }
  return res.data
}

/**
 * 访问流程（与 Web 端 src/services/marketData/loader.ts 保持一致，多了多源回退）：
 * 1. 按顺序尝试每个数据源：先查 metadata.json 判断数据版本（时间戳参数兜底防缓存）
 * 2. 按「?v=版本」加载 historical.json（版本号变化 → URL 变化 → 缓存自动失效）
 * 3. 校验 metadata 与 historical 的一致性（条数 + 最新日期），不一致视为版本错误
 * 主源挂了自动切下一个源；全部失败时抛最后一个错误。
 */
export async function loadDashboardData(): Promise<DashboardData> {
  let lastError: unknown = null
  for (const base of DATA_SOURCES) {
    try {
      const meta = await getJson<Metadata>(base, `/data/metadata.json?t=${Date.now()}`)
      const records = await getJson<DailyRecord[]>(base, `/data/historical.json?v=${meta.version}`)
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('历史行情文件为空或格式错误')
      }
      if (meta.count !== records.length || meta.lastDate !== records[records.length - 1].date) {
        throw new DataVersionMismatchError()
      }
      return { meta, records }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
