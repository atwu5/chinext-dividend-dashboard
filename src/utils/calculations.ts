import { REF_HIGH, REF_LOW } from '../../shared/indices'
import type { DailyRecord } from '../../shared/types'

export type Zone = 'low' | 'mid' | 'high'

export interface ZoneStyle {
  label: string
  color: string
}

export const ZONE_STYLES: Record<Zone, ZoneStyle> = {
  low: { label: '历史低位参考区', color: '#20A97B' },
  mid: { label: '历史参考区间', color: '#5A6B85' },
  high: { label: '历史高位参考区', color: '#E65B64' },
}

/** 比值 ≤ 0.300 低位参考区；0.300–0.700 之间参考区间；≥ 0.700 高位参考区 */
export function zoneOf(ratio: number): Zone {
  if (ratio <= REF_LOW) return 'low'
  if (ratio >= REF_HIGH) return 'high'
  return 'mid'
}

export function zoneStyleOf(ratio: number): ZoneStyle {
  return ZONE_STYLES[zoneOf(ratio)]
}

/** 界面展示 3 位小数（存储为 6 位精度，后续计算直接用存储值） */
export function fmtRatio(r: number): string {
  return r.toFixed(3)
}

/** 与参考线的带方向差值（绝对差值 + 方向符号），例：0.632 → 低位 +0.332 / 高位 -0.068 */
export function signedDiff(ratio: number, line: number): string {
  const d = ratio - line
  return `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(3)}`
}

/** 最新有效交易日相对前一有效交易日的涨跌幅（%）；缺少前一交易日时返回 null（展示 —） */
export function latestPct(records: DailyRecord[], key: 'chinextClose' | 'dividendClose'): number | null {
  if (records.length < 2) return null
  const cur = records[records.length - 1][key]
  const prev = records[records.length - 2][key]
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null
  return (cur / prev - 1) * 100
}

export function fmtPct(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—'
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`
}

/** 当前比值在 0.300–0.700 区间中的位置百分比（超出区间时收敛到 0/100，由 UI 提示越界） */
export function ratioPositionPct(ratio: number): number {
  const p = ((ratio - REF_LOW) / (REF_HIGH - REF_LOW)) * 100
  return Math.min(100, Math.max(0, p))
}
