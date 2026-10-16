import type { IndexKey } from '../../../shared/indices'

export interface DailyPoint {
  date: string
  close: number
}

export interface FetchRange {
  beg: string
  end: string
}

export interface IndexProvider {
  id: string
  label: string
  referer: string
  /** 拉取单个指数在 [beg, end] 区间内的日线收盘（close > 0，日期去重升序） */
  fetchDaily(index: IndexKey, range: FetchRange): Promise<DailyPoint[]>
}
