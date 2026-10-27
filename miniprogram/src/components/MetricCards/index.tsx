/**
 * 四张核心指标卡：与 Web 端 MetricCards 逐卡对齐。
 * 差异：framer-motion 卡片动效改为 CSS 动画；图标箭头用文本符号（小程序无 lucide）。
 */
import { Text, View } from '@tarojs/components'
import type { DailyRecord } from '../../../../shared/types'
import { INDEX_META, REF_HIGH, REF_LOW } from '../../../../shared/indices'
import {
  fmtPct,
  fmtRatio,
  latestPct,
  ratioPositionPct,
  signedDiff,
  zoneOf,
} from '../../../../shared/calculations'
import { fmtPoint } from '../../../../shared/format'
import { useCountUp } from '../../hooks/useCountUp'
import StatusIndicator from '../StatusIndicator'
import { CHART_COLORS } from '../../services/chartOption'
import './index.scss'

/** 卡片一：当前相对比值 + 状态 + 距两条参考线的差值（带方向符号的绝对差值） */
function RatioCard({ ratio }: { ratio: number }) {
  const shown = useCountUp(ratio, true)
  return (
    <>
      <Text className='mc-ratio-value'>{fmtRatio(shown)}</Text>
      <View className='mc-ratio-status'>
        <StatusIndicator ratio={ratio} size='sm' />
      </View>
      <View className='mc-diff-rows'>
        <View className='mc-diff-row'>
          <View className='mc-diff-label'>
            <View className='mc-dot' style={{ backgroundColor: CHART_COLORS.LOW }} />
            <Text className='mc-diff-text'>距低位 {REF_LOW.toFixed(3)}</Text>
          </View>
          <Text className='mc-diff-value'>{signedDiff(ratio, 0.3)}</Text>
        </View>
        <View className='mc-diff-row'>
          <View className='mc-diff-label'>
            <View className='mc-dot' style={{ backgroundColor: CHART_COLORS.HIGH }} />
            <Text className='mc-diff-text'>距高位 {REF_HIGH.toFixed(3)}</Text>
          </View>
          <Text className='mc-diff-value'>{signedDiff(ratio, 0.7)}</Text>
        </View>
      </View>
    </>
  )
}

/** 卡片二 / 三：指数最新收盘 + 当日涨跌幅 + 最新有效交易日（A股惯例涨红跌绿） */
function IndexCard({ close, pct, date }: { close: number; pct: number | null; date: string }) {
  return (
    <>
      <View className='mc-index-row'>
        <Text className='mc-index-close'>{fmtPoint(close)}</Text>
        {pct !== null && Number.isFinite(pct) ? (
          <Text
            className={`mc-pct-badge ${pct >= 0 ? 'mc-pct-up' : 'mc-pct-down'}`}
          >
            {pct >= 0 ? '↑' : '↓'} {fmtPct(pct)}
          </Text>
        ) : (
          <Text className='mc-pct-badge mc-pct-none'>—</Text>
        )}
      </View>
      <Text className='mc-index-date'>{date} 收盘</Text>
    </>
  )
}

/** 卡片四：0.300–0.700 横向位置条；比值越界时提示「低于/高于参考区间」，不把数值硬塞回区间内 */
function IntervalCard({ ratio }: { ratio: number }) {
  const pos = ratioPositionPct(ratio)
  const zone = zoneOf(ratio)
  const outOfRange = zone !== 'mid'
  return (
    <>
      <View className='mc-bar-wrap'>
        <Text
          className='mc-bar-value'
          style={
            pos < 12
              ? { left: 0, transform: 'none' }
              : pos > 88
                ? { left: 'auto', right: 0, transform: 'none' }
                : { left: `${pos}%` }
          }
        >
          {fmtRatio(ratio)}
          {outOfRange && (zone === 'low' ? ' ↓' : ' ↑')}
        </Text>
        <View className='mc-bar-track'>
          <View className='mc-bar-marker' style={{ left: `${pos}%` }} />
        </View>
        <View className='mc-bar-labels'>
          <View className='mc-bar-label-side'>
            <View className='mc-dot' style={{ backgroundColor: CHART_COLORS.LOW }} />
            <Text className='mc-diff-text'>低位线 {REF_LOW.toFixed(3)}</Text>
          </View>
          <View className='mc-bar-label-side'>
            <Text className='mc-diff-text'>高位线 {REF_HIGH.toFixed(3)}</Text>
            <View className='mc-dot' style={{ backgroundColor: CHART_COLORS.HIGH }} />
          </View>
        </View>
      </View>
      {outOfRange && (
        <Text
          className='mc-bar-out'
          style={{ color: zone === 'low' ? CHART_COLORS.LOW : CHART_COLORS.HIGH }}
        >
          当前比值{zone === 'low' ? '低于' : '高于'}参考区间
        </Text>
      )}
    </>
  )
}

function CardShell({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View className='mc-card mc-fade-in'>
      <View className='mc-card-head'>
        <Text className='mc-card-label'>{label}</Text>
        {sub && <Text className='mc-card-sub'>{sub}</Text>}
      </View>
      <View className='mc-card-body'>{children}</View>
    </View>
  )
}

export default function MetricCards({ records }: { records: DailyRecord[] }) {
  const last = records[records.length - 1]
  const chinextPct = latestPct(records, 'chinextClose')
  const dividendPct = latestPct(records, 'dividendClose')
  return (
    <View className='mc-grid'>
      <CardShell label='当前相对比值' sub='创业板 ÷ 中证红利'>
        <RatioCard ratio={last.ratio} />
      </CardShell>
      <CardShell label={INDEX_META.chinext.displayName} sub={INDEX_META.chinext.fullCode}>
        <IndexCard close={last.chinextClose} pct={chinextPct} date={last.date} />
      </CardShell>
      <CardShell label={INDEX_META.dividend.displayName} sub={INDEX_META.dividend.fullCode}>
        <IndexCard close={last.dividendClose} pct={dividendPct} date={last.date} />
      </CardShell>
      <CardShell label='历史参考区间' sub='0.300 – 0.700'>
        <IntervalCard ratio={last.ratio} />
      </CardShell>
    </View>
  )
}
