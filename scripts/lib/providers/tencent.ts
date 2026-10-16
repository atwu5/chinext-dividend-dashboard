import { INDEX_META, type IndexKey } from '../../../shared/indices'
import { shiftDays } from '../dates'
import { getJson } from '../http'
import type { DailyPoint, FetchRange, IndexProvider } from './types'

interface TxResponse {
  code?: number
  data?: Record<string, { day?: string[][]; qfqday?: string[][]; name?: string }>
}

const PAGE_SIZE = 640

/**
 * 腾讯财经日K接口（公开、无需密钥）——备用数据源（东方财富失败时自动降级）。
 * 单次最多返回 640 条，通过日期游标分页拉满整个区间。
 * 指数无复权概念，qfq 参数对指数等同于不复权；返回行结构 [date, open, close, high, low, volume, ...]。
 */
export const tencentProvider: IndexProvider = {
  id: 'tencent',
  label: '腾讯财经日K接口',
  referer: 'https://gu.qq.com/',
  async fetchDaily(index: IndexKey, range: FetchRange): Promise<DailyPoint[]> {
    const meta = INDEX_META[index]
    const symbol = meta.tencentSymbol
    const out = new Map<string, number>()
    let cursor = range.beg
    for (let page = 0; page < 200; page += 1) {
      const url =
        'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get' +
        `?param=${symbol},day,${cursor},${range.end},${PAGE_SIZE},qfq`
      const json = await getJson<TxResponse>(url, this.referer)
      const block = json.data?.[symbol]
      const rows = block?.qfqday ?? block?.day ?? []
      if (rows.length === 0) break
      let lastDate = ''
      for (const row of rows) {
        const date = row[0]
        const close = Number(row[2])
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        if (date < range.beg || date > range.end) continue
        if (!Number.isFinite(close) || close <= 0) continue
        out.set(date, close)
        if (date > lastDate) lastDate = date
      }
      if (!lastDate || lastDate >= range.end) break
      cursor = shiftDays(lastDate, 1)
      if (cursor > range.end) break
    }
    if (out.size === 0) {
      throw new Error(`tencent：${symbol} 区间 [${range.beg}, ${range.end}] 无有效数据`)
    }
    const points = [...out.entries()].map(([date, close]) => ({ date, close }))
    points.sort((a, b) => a.date.localeCompare(b.date))
    return points
  },
}
