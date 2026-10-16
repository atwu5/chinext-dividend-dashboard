import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { INDEX_META, REF_HIGH, REF_LOW } from '../../shared/indices'
import type { DailyRecord } from '../../shared/types'
import { useCountUp } from '../hooks/useCountUp'
import {
  fmtPct,
  fmtRatio,
  latestPct,
  ratioPositionPct,
  signedDiff,
  zoneOf,
} from '../utils/calculations'
import { fmtPoint } from '../utils/format'
import StatusIndicator from './StatusIndicator'

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

function CardShell({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      variants={item}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="flex flex-col rounded-2xl border border-line bg-card p-3.5 shadow-card md:p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {sub && <span className="shrink-0 text-[10px] tabular-nums text-muted/80">{sub}</span>}
      </div>
      <div className="mt-2 flex-1">{children}</div>
    </motion.div>
  )
}

/** 卡片一：当前相对比值 + 状态 + 距两条参考线的差值（带方向符号的绝对差值） */
function RatioCard({ ratio }: { ratio: number }) {
  const reduce = useReducedMotion()
  const animated = useCountUp(ratio, !reduce)
  const shown = reduce ? ratio : animated
  return (
    <>
      <div className="text-2xl font-bold tabular-nums text-gold md:text-3xl">{fmtRatio(shown)}</div>
      <div className="mt-1.5">
        <StatusIndicator ratio={ratio} size="sm" />
      </div>
      <div className="mt-2 space-y-1 text-[11px] tabular-nums text-muted">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zone-low" />
            距低位 {REF_LOW.toFixed(3)}
          </span>
          <b className="font-semibold text-ink">{signedDiff(ratio, REF_LOW)}</b>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zone-high" />
            距高位 {REF_HIGH.toFixed(3)}
          </span>
          <b className="font-semibold text-ink">{signedDiff(ratio, REF_HIGH)}</b>
        </div>
      </div>
    </>
  )
}

/** 卡片二 / 三：指数最新收盘 + 当日涨跌幅 + 最新有效交易日（A股惯例涨红跌绿） */
function IndexCard({ close, pct, date }: { close: number; pct: number | null; date: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xl font-semibold tabular-nums md:text-[22px]">{fmtPoint(close)}</span>
        {pct !== null && Number.isFinite(pct) ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              pct >= 0 ? 'bg-[#E65B64]/10 text-zone-high' : 'bg-[#20A97B]/10 text-zone-low'
            }`}
          >
            {pct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmtPct(pct)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/10 px-1.5 py-0.5 text-[11px] text-muted">
            <Minus size={12} />—
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[11px] tabular-nums text-muted">{date} 收盘</div>
    </>
  )
}

/** 卡片四：0.300–0.700 横向位置条；比值越界时提示「低于/高于参考区间」，不把数值硬塞回区间内 */
function IntervalCard({ ratio }: { ratio: number }) {
  const pos = ratioPositionPct(ratio)
  const zone = zoneOf(ratio)
  const outOfRange = zone !== 'mid'
  const labelClass =
    pos < 12 ? 'left-0' : pos > 88 ? 'right-0' : 'left-full -translate-x-1/2'
  return (
    <>
      <div className="relative pt-6">
        <span
          className={`absolute top-0 whitespace-nowrap text-[11px] font-semibold tabular-nums ${labelClass}`}
          style={pos >= 12 && pos <= 88 ? { left: `${pos}%` } : undefined}
        >
          {fmtRatio(ratio)}
          {outOfRange && (zone === 'low' ? ' ↓' : ' ↑')}
        </span>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-zone-low/30 via-muted/25 to-zone-high/30">
          <span
            className="absolute -top-[3px] h-4 w-[5px] -translate-x-1/2 rounded-full bg-ink shadow"
            style={{ left: `${pos}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] tabular-nums text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zone-low" />
            低位线 {REF_LOW.toFixed(3)}
          </span>
          <span className="inline-flex items-center gap-1">
            高位线 {REF_HIGH.toFixed(3)}
            <span className="h-1.5 w-1.5 rounded-full bg-zone-high" />
          </span>
        </div>
      </div>
      {outOfRange && (
        <div className={`mt-2 text-[11px] font-medium ${zone === 'low' ? 'text-zone-low' : 'text-zone-high'}`}>
          当前比值{zone === 'low' ? '低于' : '高于'}参考区间
        </div>
      )}
    </>
  )
}

export default function MetricCards({ records }: { records: DailyRecord[] }) {
  const last = records[records.length - 1]
  const chinextPct = latestPct(records, 'chinextClose')
  const dividendPct = latestPct(records, 'dividendClose')
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <CardShell label="当前相对比值" sub="创业板 ÷ 中证红利">
        <RatioCard ratio={last.ratio} />
      </CardShell>
      <CardShell label={INDEX_META.chinext.displayName} sub={INDEX_META.chinext.fullCode}>
        <IndexCard close={last.chinextClose} pct={chinextPct} date={last.date} />
      </CardShell>
      <CardShell label={INDEX_META.dividend.displayName} sub={INDEX_META.dividend.fullCode}>
        <IndexCard close={last.dividendClose} pct={dividendPct} date={last.date} />
      </CardShell>
      <CardShell label="历史参考区间" sub="0.300 – 0.700">
        <IntervalCard ratio={last.ratio} />
      </CardShell>
    </motion.div>
  )
}
