import type { IndexKey } from './indices'

/** historical.json 中的单条记录 */
export interface DailyRecord {
  /** 交易日期 YYYY-MM-DD */
  date: string
  /** 创业板指数收盘点位 */
  chinextClose: number
  /** 中证红利指数收盘点位 */
  dividendClose: number
  /** 相对比值 = 创业板指 ÷ 中证红利（存储 6 位小数） */
  ratio: number
}

export interface IndexDataMeta {
  /** 标准化代码，如 399006.SZ */
  fullCode: string
  /** 数据商侧代码（secid 或带市场前缀代码） */
  providerSymbol: string
  /** 指数名称（来自数据源返回，用于防错标的） */
  name: string
  firstDate: string
  lastDate: string
}

/** metadata.json 结构 */
export interface Metadata {
  timelineStart: string
  /** 数据源 id（eastmoney / tencent，可替换） */
  source: string
  sourceName: string
  caliber: string
  indices: Record<IndexKey, IndexDataMeta>
  firstDate: string
  lastDate: string
  count: number
  /** 数据版本：每次数据变化 +1，前端用它做缓存失效 */
  version: number
  lastUpdated: string
  lastUpdateSource?: string
  ratioDefinition: string
  scriptVersion: string
}
