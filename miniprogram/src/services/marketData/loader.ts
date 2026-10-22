import Taro from '@tarojs/taro'
import type { DailyRecord, Metadata } from '../../../../shared/types'
import { DATA_BASE_URL } from '../../config'

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

async function getJson<T>(url: string): Promise<T> {
  const res = await Taro.request<T>({ url, dataType: 'json' })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`HTTP ${res.statusCode} · ${url.replace(DATA_BASE_URL, '')}`)
  }
  return res.data
}

/**
 * 访问流程（与 Web 端 src/services/marketData/loader.ts 保持一致）：
 * 1. 请求 metadata.json 判断数据版本（时间戳参数兜底防缓存）
 * 2. 按「?v=版本」加载 historical.json（缓存可长期保留；版本号变化 → URL 变化 → 缓存自动失效）
 * 3. 校验 metadata 与 historical 的一致性（条数 + 最新日期），不一致视为版本错误并提示刷新
 */
export async function loadDashboardData(): Promise<DashboardData> {
  const meta = await getJson<Metadata>(`${DATA_BASE_URL}/data/metadata.json?t=${Date.now()}`)
  const records = await getJson<DailyRecord[]>(`${DATA_BASE_URL}/data/historical.json?v=${meta.version}`)
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('历史行情文件为空或格式错误')
  }
  if (meta.count !== records.length || meta.lastDate !== records[records.length - 1].date) {
    throw new DataVersionMismatchError()
  }
  return { meta, records }
}
