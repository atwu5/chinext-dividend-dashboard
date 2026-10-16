import { INDEX_META, type IndexKey } from '../../../shared/indices'
import { getJson } from '../http'
import type { DailyPoint, FetchRange, IndexProvider } from './types'

interface EmResponse {
  data?: {
    code?: string
    name?: string
    klines?: string[]
  }
}

function toCompactDate(s: string): string {
  return s.split('-').join('')
}

/**
 * 东方财富 push2his 日K接口（公开、无需密钥）——主数据源。
 * secid 规则：0 = 深市、1 = 沪市；klt=101 日线；fqt=0 不复权。
 * 通过 code + name 双重断言防止拿错标的
 * （例如深市个股 000922「佳电股份」 vs 沪市指数 000922「中证红利」）。
 */
export const eastmoneyProvider: IndexProvider = {
  id: 'eastmoney',
  label: '东方财富 push2his 行情接口',
  referer: 'https://quote.eastmoney.com/',
  async fetchDaily(index: IndexKey, range: FetchRange): Promise<DailyPoint[]> {
    const meta = INDEX_META[index]
    const url =
      'https://push2his.eastmoney.com/api/qt/stock/kline/get' +
      `?secid=${meta.eastmoneySecid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f53` +
      `&klt=101&fqt=0&beg=${toCompactDate(range.beg)}&end=${toCompactDate(range.end)}&lmt=1000000`
    const json = await getJson<EmResponse>(url, this.referer)
    const data = json.data
    if (!data || !Array.isArray(data.klines)) {
      throw new Error(`eastmoney：${meta.fullCode} 返回空数据（接口结构变化或暂不可用）`)
    }
    if (data.code !== meta.code) {
      throw new Error(`eastmoney：返回代码 ${data.code} 与目标指数 ${meta.fullCode} 不符，终止以免取错标的`)
    }
    if (!data.name || !data.name.includes(meta.name)) {
      throw new Error(`eastmoney：返回名称「${data.name ?? ''}」与目标指数「${meta.name}」不符，终止以免取错标的`)
    }
    const out: DailyPoint[] = []
    const seen = new Set<string>()
    for (const line of data.klines) {
      const [date, closeStr] = line.split(',')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      if (date < range.beg || date > range.end) continue
      const close = Number(closeStr)
      if (!Number.isFinite(close) || close <= 0) continue
      if (seen.has(date)) continue
      seen.add(date)
      out.push({ date, close })
    }
    out.sort((a, b) => a.date.localeCompare(b.date))
    return out
  },
}
