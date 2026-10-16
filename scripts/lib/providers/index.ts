import { INDEX_KEYS, type IndexKey } from '../../../shared/indices'
import { eastmoneyProvider } from './eastmoney'
import { tencentProvider } from './tencent'
import type { DailyPoint, IndexProvider } from './types'

export type { DailyPoint, FetchRange, IndexProvider } from './types'

export interface IndexCloseMap {
  chinext: Map<string, number>
  dividend: Map<string, number>
  provider: IndexProvider
}

function pointsToMap(points: DailyPoint[]): Map<string, number> {
  return new Map(points.map((p) => [p.date, p.close]))
}

/**
 * 用同一数据源拉齐两个指数（避免混源导致口径不一致）。
 * 按主源 → 备用源顺序尝试；某个源对任一指数失败则整源降级；全部失败抛出合并错误。
 * 替换 / 新增数据源：实现 IndexProvider 并加入 providers 数组即可。
 */
export async function fetchBothIndices(range: { beg: string; end: string }): Promise<IndexCloseMap> {
  const providers: IndexProvider[] = [eastmoneyProvider, tencentProvider]
  const errors: string[] = []
  for (const provider of providers) {
    try {
      const results = new Map<IndexKey, DailyPoint[]>()
      for (const key of INDEX_KEYS) {
        results.set(key, await provider.fetchDaily(key, range))
      }
      return {
        chinext: pointsToMap(results.get('chinext') ?? []),
        dividend: pointsToMap(results.get('dividend') ?? []),
        provider,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`[${provider.id}] ${message}`)
      console.warn(`数据源 ${provider.id} 失败：${message}`)
    }
  }
  throw new Error(`所有数据源均不可用：\n${errors.join('\n')}`)
}
