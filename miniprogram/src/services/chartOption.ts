/**
 * 主图 option 构建：与 Web 端 src/components/MainChart.tsx 的 buildOption 逻辑保持一致
 * （双纵轴三序列 + 0.3/0.7 参考线隐形载体 + 全历史极值标记点 + inside/slider 缩放）。
 * 与 Web 的差异：小程序无 DOM，HTML tooltip 与可见图例由 Taro 侧组件自绘替代，
 * legend 组件以 show:false 参与构建（仍可通过 dispatchAction 控制曲线显隐）。
 * 合并回 main 时与 Web 端一起抽到 shared/ 收口。
 */
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { REF_HIGH, REF_LOW, TIMELINE_START } from '../../../shared/indices'
import type { DailyRecord } from '../../../shared/types'
import { laterDate, pad2, shiftYearsISO } from '../../../shared/format'

export const CHART_COLORS = {
  GOLD: '#C5A46D',
  BLUE: '#426997',
  LOW: '#20A97B',
  HIGH: '#E65B64',
  INK: '#202C40',
  MUTED: '#8792A5',
  LINE: '#E7EAF1',
} as const

export type Granularity = 'day' | 'month' | 'year'
export type RangeKey = '1y' | '3y' | '5y' | 'all'

export const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

export const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '1y', label: '近1年' },
  { value: '3y', label: '近3年' },
  { value: '5y', label: '近5年' },
  { value: 'all', label: '全部' },
]

export interface ChartExtremes {
  low: DailyRecord
  high: DailyRecord
}

export function makeAxisFormatter(g: Granularity): (ts: number) => string {
  return (ts: number) => {
    const d = new Date(ts)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    if (g === 'year') return String(y)
    if (g === 'month') return `${y}-${pad2(m)}`
    return `${y}-${pad2(m)}-${pad2(day)}`
  }
}

/** 右轴（比值）自动缩放时始终把 0.3 / 0.7 参考线包含在可视范围内，且不允许裁切曲线 */
export function ratioAxisExtent(v: { min: number; max: number }): { min: number; max: number } {
  const lo = Math.min(v.min, REF_LOW)
  const hi = Math.max(v.max, REF_HIGH)
  const padSpan = Math.max((hi - lo) * 0.08, 0.03)
  const round = (x: number) => Math.round(x * 1000) / 1000
  return { min: round(lo - padSpan), max: round(hi + padSpan) }
}

/** 快捷范围的可见窗口起点：'all' → 时间轴起点；其余 → 最后日期前推 N 年（不早于首条记录） */
export function rangeStartValue(records: DailyRecord[], rangeKey: RangeKey): string {
  if (rangeKey === 'all' || records.length === 0) return TIMELINE_START
  const last = records[records.length - 1].date
  const first = records[0].date
  const years = rangeKey === '1y' ? 1 : rangeKey === '3y' ? 3 : 5
  return laterDate(shiftYearsISO(last, -years), first)
}

export function buildMainChartOption(opts: {
  records: DailyRecord[]
  granularity: Granularity
  extremes: ChartExtremes
  legendSelected: Record<string, boolean>
  animation: boolean
}): EChartsCoreOption {
  const { records, granularity, extremes, legendSelected, animation } = opts
  const lastDate = records[records.length - 1].date

  const baseX = {
    type: 'time' as const,
    min: TIMELINE_START, // 时间轴起点固定为创业板开市日，指数发布前保留空白
    axisLine: { lineStyle: { color: '#D9DEE8' } },
    axisTick: { show: false },
    splitLine: { show: false },
  }
  const axisLabel = {
    hideOverlap: true,
    color: CHART_COLORS.MUTED,
    fontSize: 11,
    formatter: makeAxisFormatter(granularity),
  }
  const xAxis = [{ ...baseX, axisLabel }]

  const ratioAxis = {
    type: 'value' as const,
    min: (v: { min: number; max: number }) => ratioAxisExtent(v).min,
    max: (v: { min: number; max: number }) => ratioAxisExtent(v).max,
    axisLabel: { color: CHART_COLORS.MUTED, fontSize: 10, formatter: (v: number) => v.toFixed(2) },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    name: '相对比值',
    nameGap: 10,
    nameTextStyle: { color: CHART_COLORS.MUTED, fontSize: 10, align: 'right' as const, padding: [0, 2, 0, 0] },
  }
  const indexAxis = {
    type: 'value' as const,
    scale: true,
    axisLabel: { color: CHART_COLORS.MUTED, fontSize: 10, formatter: (v: number) => v.toLocaleString('en-US') },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#EEF1F6' } },
    name: '指数点位（点）',
    nameGap: 10,
    nameTextStyle: { color: CHART_COLORS.MUTED, fontSize: 10, align: 'left' as const, padding: [0, 0, 0, 2] },
  }
  const yAxis = [indexAxis, ratioAxis]
  // 顶部图例已由 Taro chips 承担，grid 顶部留白比 Web 小
  const grid = [{ left: 56, right: 56, top: 30, bottom: 72 }]

  const option = {
    animation,
    animationDuration: animation ? 1000 : 0,
    animationDurationUpdate: animation ? 350 : 0,
    animationEasing: 'cubicOut',
    legend: {
      show: false,
      data: ['创业板指数', '创业板/中证红利', '0.300 低位参考', '0.700 高位参考'],
      selected: { ...legendSelected },
    },
    grid,
    xAxis,
    yAxis,
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0],
        filterMode: 'filter',
        throttle: 60,
        minSpan: 2,
      },
      {
        type: 'slider',
        xAxisIndex: [0],
        filterMode: 'filter',
        height: 22,
        bottom: 14,
        left: 10,
        right: 10,
        showDataShadow: false,
        brushSelect: false,
        borderColor: CHART_COLORS.LINE,
        backgroundColor: '#F3F5F9',
        fillerColor: 'rgba(197,164,109,0.18)',
        handleStyle: { color: '#FFFFFF', borderColor: CHART_COLORS.GOLD },
        moveHandleStyle: { color: '#E4D9C2' },
        dataBackground: {
          lineStyle: { color: 'rgba(197,164,109,0.45)' },
          areaStyle: { color: 'rgba(197,164,109,0.10)' },
        },
        selectedDataBackground: {
          lineStyle: { color: CHART_COLORS.GOLD },
          areaStyle: { color: 'rgba(197,164,109,0.20)' },
        },
        textStyle: { color: CHART_COLORS.MUTED, fontSize: 10 },
      },
    ],
    series: [
      {
        // 参考线载体：恒定值隐形系列。必须绑定右轴（比值轴）且有数据，markLine 才会渲染；
        // 不参与图例，用户隐藏比值曲线时 0.3/0.7 参考线仍持续显示
        name: '__reference_lines',
        type: 'line',
        data: [
          [TIMELINE_START, REF_LOW],
          [lastDate, REF_LOW],
        ],
        xAxisIndex: 0,
        yAxisIndex: 1,
        silent: true,
        showSymbol: false,
        lineStyle: { opacity: 0 },
        emphasis: { disabled: true },
        legendHoverLink: false,
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          label: { show: false },
          lineStyle: { type: 'dashed', width: 1.2 },
          data: [
            { yAxis: REF_LOW, lineStyle: { color: CHART_COLORS.LOW, shadowColor: 'rgba(32,169,123,0.35)', shadowBlur: 6 } },
            { yAxis: REF_HIGH, lineStyle: { color: CHART_COLORS.HIGH, shadowColor: 'rgba(230,91,100,0.35)', shadowBlur: 6 } },
          ],
        },
      },
      {
        name: '创业板指数',
        type: 'line',
        data: records.map((r) => [r.date, r.chinextClose]),
        showSymbol: false,
        lineStyle: { width: 1.4, color: CHART_COLORS.BLUE },
        itemStyle: { color: CHART_COLORS.BLUE },
        color: CHART_COLORS.BLUE,
        z: 2,
      },
      {
        name: '创业板/中证红利',
        type: 'line',
        data: records.map((r) => [r.date, r.ratio]),
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { width: 2.2, color: CHART_COLORS.GOLD },
        itemStyle: { color: CHART_COLORS.GOLD },
        color: CHART_COLORS.GOLD,
        z: 3,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(197,164,109,0.16)' },
            { offset: 1, color: 'rgba(197,164,109,0)' },
          ]),
        },
        // 全历史极值标记（绿最低 / 红最高），点击查看当日两指数点位与比值
        markPoint: {
          silent: false,
          animation: false,
          symbol: 'circle',
          symbolSize: 9,
          itemStyle: { borderColor: '#FFFFFF', borderWidth: 1.5 },
          label: { show: false },
          emphasis: { scale: 1.5 },
          data: [
            { coord: [extremes.low.date, extremes.low.ratio], itemStyle: { color: CHART_COLORS.LOW } },
            { coord: [extremes.high.date, extremes.high.ratio], itemStyle: { color: CHART_COLORS.HIGH } },
          ],
        },
      },
      {
        // 十字准星竖线：触摸移动时由 RatioChart 更新（小程序无 DOM tooltip 的替代实现）
        name: '__crosshair',
        type: 'line',
        data: [],
        xAxisIndex: 0,
        yAxisIndex: 1,
        silent: true,
        showSymbol: false,
        lineStyle: { opacity: 0 },
        legendHoverLink: false,
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          label: { show: false },
          lineStyle: { color: '#C3CAD6', type: 'solid', width: 1 },
          data: [] as Array<{ xAxis: string }>,
        },
      },
      {
        // 参考线图例说明（空数据系列，仅用于图例 chips 的语义开关；不影响真实参考线）
        name: '0.300 低位参考',
        type: 'line',
        data: [],
        itemStyle: { color: CHART_COLORS.LOW },
        lineStyle: { color: CHART_COLORS.LOW, type: 'dashed' },
        color: CHART_COLORS.LOW,
        silent: true,
        legendHoverLink: false,
      },
      {
        name: '0.700 高位参考',
        type: 'line',
        data: [],
        itemStyle: { color: CHART_COLORS.HIGH },
        lineStyle: { color: CHART_COLORS.HIGH, type: 'dashed' },
        color: CHART_COLORS.HIGH,
        silent: true,
        legendHoverLink: false,
      },
    ],
  }
  return option as EChartsCoreOption
}
