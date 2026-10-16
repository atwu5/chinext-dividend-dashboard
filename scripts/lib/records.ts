import { RATIO_DECIMALS } from '../../shared/indices'
import type { DailyRecord } from '../../shared/types'
import type { IndexCloseMap } from './providers'

/** 相对比值 = 创业板指 ÷ 中证红利，存储精度 6 位小数（界面展示 3 位） */
export function roundRatio(chinextClose: number, dividendClose: number): number {
  const factor = 10 ** RATIO_DECIMALS
  return Math.round((chinextClose / dividendClose) * factor) / factor
}

/** 将两个指数的收盘 Map 合并为记录数组：仅保留同日均有收盘数据的交易日，按日期升序 */
export function buildRecords(closes: IndexCloseMap): DailyRecord[] {
  const dates = [...closes.chinext.keys()].filter((d) => closes.dividend.has(d)).sort()
  return dates.map((date) => {
    const chinextClose = closes.chinext.get(date)
    const dividendClose = closes.dividend.get(date)
    if (chinextClose === undefined || dividendClose === undefined) {
      throw new Error(`数据不一致：${date} 缺少某一指数收盘`)
    }
    return { date, chinextClose, dividendClose, ratio: roundRatio(chinextClose, dividendClose) }
  })
}
