import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  AxisPointerComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { REF_HIGH, REF_LOW, TIMELINE_START } from '../../shared/indices'
import type { DailyRecord } from '../../shared/types'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { zoneStyleOf } from '../utils/calculations'
import { fmtDateUTC, fmtPoint, pad2, shiftYearsISO, laterDate } from '../utils/format'
import { fmtRatio } from '../utils/calculations'
import TimeRangeSelector, { type Granularity, type RangeKey } from './TimeRangeSelector'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AxisPointerComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
])

const GOLD = '#C5A46D'
const BLUE = '#426997'
const LOW = '#20A97B'
const HIGH = '#E65B64'
const INK = '#202C40'
const MUTED = '#8792A5'
const LINE = '#E7EAF1'

type ChartInstance = ReturnType<typeof echarts.init>
type ChartOption = Parameters<ChartInstance['setOption']>[0]

interface Props {
  records: DailyRecord[]
  granularity: Granularity
  /** 坐标刻度切换（状态由父级持有） */
  onGranularityChange: (g: Granularity) => void
  rangeKey: RangeKey
  /** 快捷时间范围切换（状态由父级持有） */
  onRangeChange: (r: RangeKey) => void
  reducedMotion: boolean
  /** 图表卡是否处于全屏模式（真实全屏或移动端模拟全屏，下图表格子自动拉伸） */
  isFullscreen?: boolean
  /** 进入/退出全屏（父级实现；未提供时不显示全屏按钮） */
  onToggleFullscreen?: () => void
}

function makeAxisFormatter(g: Granularity) {
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
function ratioAxisExtent(v: { min: number; max: number }): { min: number; max: number } {
  const lo = Math.min(v.min, REF_LOW)
  const hi = Math.max(v.max, REF_HIGH)
  const padSpan = Math.max((hi - lo) * 0.08, 0.03)
  const round = (x: number) => Math.round(x * 1000) / 1000
  return { min: round(lo - padSpan), max: round(hi + padSpan) }
}

/** 信息浮层避让边缘：优先出现在指针上方，越界时翻转并夹紧到图表内 */
function clampTooltipPosition(
  point: number[],
  _params: unknown,
  _dom: unknown,
  _rect: unknown,
  size: { contentSize: number[]; viewSize: number[] },
): number[] {
  const [x, y] = point
  const [w, h] = size.contentSize
  const [vw, vh] = size.viewSize
  let px = x + 16
  if (px + w > vw - 8) px = x - w - 16
  if (px < 8) px = 8
  let py = y - h - 14
  if (py < 8) py = y + 16
  if (py + h > vh - 8) py = vh - h - 8
  return [px, py]
}

export default function MainChart({
  records,
  granularity,
  onGranularityChange,
  rangeKey,
  onRangeChange,
  reducedMotion,
  isFullscreen = false,
  onToggleFullscreen,
}: Props) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartInstance | null>(null)
  const zoomRef = useRef<{ start?: number; end?: number } | null>(null)
  const legendRef = useRef<Record<string, boolean>>({ 创业板指数: true, '创业板/中证红利': true })
  const [extreme, setExtreme] = useState<{ kind: 'low' | 'high'; rec: DailyRecord } | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const coarse = useMediaQuery('(pointer: coarse)')
  const isWide = useMediaQuery('(min-width: 768px)')

  const recordMap = useMemo(() => new Map(records.map((r) => [r.date, r])), [records])
  const extremes = useMemo(() => {
    let low = records[0]
    let high = records[0]
    for (const r of records) {
      if (r.ratio < low.ratio) low = r
      if (r.ratio > high.ratio) high = r
    }
    return { low, high }
  }, [records])

  // 通过 ref 让构建函数读到最新 UI 状态，同时避免重建图表实例
  const granularityRef = useRef(granularity)
  granularityRef.current = granularity
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion
  const coarseRef = useRef(coarse)
  coarseRef.current = coarse
  const isWideRef = useRef(isWide)
  isWideRef.current = isWide

  const resetZoom = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    try {
      chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
      zoomRef.current = { start: 0, end: 100 }
    } catch {
      // 忽略重置异常
    }
  }, [])

  const buildOption = useCallback((): ChartOption => {
    const g = granularityRef.current
    const reduced = reducedRef.current
    const isCoarse = coarseRef.current
    const wide = isWideRef.current

    const baseX = {
      type: 'time' as const,
      min: TIMELINE_START, // 时间轴起点固定为 2009-10-30（创业板开市日，指数发布前保留空白）
      axisLine: { lineStyle: { color: '#D9DEE8' } },
      axisTick: { show: false },
      splitLine: { show: false },
    }
    const axisLabel = {
      hideOverlap: true,
      color: MUTED,
      fontSize: 11,
      formatter: makeAxisFormatter(g),
    }
    const pointerLabel = { show: true, backgroundColor: INK, fontSize: 10 }

    const xAxis = [{ ...baseX, axisLabel, axisPointer: { label: pointerLabel } }]

    const ratioAxis = {
      type: 'value' as const,
      min: (v: { min: number; max: number }) => ratioAxisExtent(v).min,
      max: (v: { min: number; max: number }) => ratioAxisExtent(v).max,
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => v.toFixed(2) },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      name: '相对比值',
      nameGap: 10,
      nameTextStyle: { color: MUTED, fontSize: 10, align: 'right' as const, padding: [0, 2, 0, 0] },
      axisPointer: { label: { formatter: (p: { value: number }) => Number(p.value).toFixed(3), backgroundColor: INK, fontSize: 10 } },
    }
    const indexAxis = {
      type: 'value' as const,
      scale: true,
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => v.toLocaleString('en-US') },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#EEF1F6' } },
      name: '指数点位（点）',
      nameGap: 10,
      nameTextStyle: { color: MUTED, fontSize: 10, align: 'left' as const, padding: [0, 0, 0, 2] },
    }
    const yAxis = [indexAxis, ratioAxis]
    const grid = [{ left: 60, right: 60, top: wide ? 64 : 86, bottom: 96 }]

    const tooltipFormatter = (params: unknown): string => {
      const arr = (Array.isArray(params) ? params : [params]) as Array<{
        seriesName?: string
        value?: unknown
        axisValue?: unknown
      }>
      const first =
        arr.find((p) => p.seriesName === '创业板指数') ??
        arr.find((p) => p.seriesName === '创业板/中证红利') ??
        arr[0]
      if (!first) return ''
      const raw = Array.isArray(first.value) ? first.value[0] : first.axisValue
      const ts = typeof raw === 'number' ? raw : Date.parse(String(raw))
      if (!Number.isFinite(ts)) return ''
      const date = fmtDateUTC(ts)
      const rec = recordMap.get(date)
      if (!rec) {
        // 数据缺失的日期不展示虚构数值
        return `<div style="font-weight:600">${date}</div><div style="color:${MUTED};margin-top:4px">该日期无有效记录</div>`
      }
      const zone = zoneStyleOf(rec.ratio)
      const row = (label: string, val: string, color?: string) =>
        `<div style="display:flex;justify-content:space-between;gap:20px;margin-top:5px"><span style="color:${MUTED}">${label}</span><b style="font-variant-numeric:tabular-nums${color ? `;color:${color}` : ''}">${val}</b></div>`
      return (
        `<div style="font-weight:600;margin-bottom:2px">${date}</div>` +
        row('创业板指数', fmtPoint(rec.chinextClose)) +
        row('中证红利', fmtPoint(rec.dividendClose)) +
        row('相对比值', fmtRatio(rec.ratio), GOLD) +
        row('相对状态', zone.label, zone.color)
      )
    }

    const option = {
      animation: !reduced,
      animationDuration: reduced ? 0 : 1000,
      animationDurationUpdate: reduced ? 0 : 350,
      animationEasing: 'cubicOut',
      axisPointer: { link: [{ xAxisIndex: 'all' }], label: { backgroundColor: INK } },
      // 图例：PC 宽屏单行放全 4 项（与曲线图例同行同规格，文字清晰）；窄屏（移动端）换两行避免溢出
      legend: wide
        ? {
            data: ['创业板指数', '创业板/中证红利', '0.300 低位参考', '0.700 高位参考'],
            top: 6,
            left: 4,
            itemWidth: 16,
            itemGap: 14,
            textStyle: { color: '#5A6B85', fontSize: 12 },
            inactiveColor: '#C3CAD6',
            selected: legendRef.current,
          }
        : [
            {
              data: ['创业板指数', '创业板/中证红利'],
              top: 6,
              left: 4,
              itemWidth: 16,
              itemGap: 14,
              textStyle: { color: '#5A6B85', fontSize: 12 },
              inactiveColor: '#C3CAD6',
              selected: legendRef.current,
            },
            {
              data: ['0.300 低位参考', '0.700 高位参考'],
              top: 28,
              left: 4,
              itemWidth: 14,
              itemGap: 12,
              textStyle: { color: '#5A6B85', fontSize: 12 },
              inactiveColor: '#C3CAD6',
              selected: legendRef.current,
            },
          ],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#C3CAD6' },
          crossStyle: { color: '#C3CAD6' },
          label: { backgroundColor: INK },
        },
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: LINE,
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: INK, fontSize: 12 },
        confine: true,
        extraCssText: 'box-shadow:0 10px 28px -10px rgba(32,44,64,0.28);border-radius:10px;',
        position: clampTooltipPosition,
        formatter: tooltipFormatter,
      },
      grid,
      xAxis,
      yAxis,
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0],
          filterMode: 'filter',
          zoomOnMouseWheel: true,
          moveOnMouseMove: !isCoarse, // 触屏设备禁止单指拖图，避免与页面纵向滚动冲突；平移走底部滑块
          moveOnMouseWheel: false,
          preventDefaultMouseMove: true,
          throttle: 60,
          minSpan: 2,
          start: zoomRef.current?.start,
          end: zoomRef.current?.end,
        },
        {
          type: 'slider',
          xAxisIndex: [0],
          filterMode: 'filter',
          height: 26,
          bottom: 22,
          left: 12,
          right: 12,
          showDataShadow: false,
          brushSelect: false,
          borderColor: LINE,
          backgroundColor: '#F3F5F9',
          fillerColor: 'rgba(197,164,109,0.18)',
          handleStyle: { color: '#FFFFFF', borderColor: GOLD },
          moveHandleStyle: { color: '#E4D9C2' },
          dataBackground: {
            lineStyle: { color: 'rgba(197,164,109,0.45)' },
            areaStyle: { color: 'rgba(197,164,109,0.10)' },
          },
          selectedDataBackground: {
            lineStyle: { color: GOLD },
            areaStyle: { color: 'rgba(197,164,109,0.20)' },
          },
          textStyle: { color: MUTED, fontSize: 10 },
          start: zoomRef.current?.start,
          end: zoomRef.current?.end,
        },
      ],
      series: [
        // 参考线载体：恒定值隐形系列（横跨全时间轴）。
        // 注意：ECharts 5 的 markLine 挂在空数据系列上不渲染，因此载体必须有数据；
        // 该系列不参与图例，即使用户隐藏比值曲线，0.3/0.7 参考线也持续显示。
        {
          name: '__reference_lines',
          type: 'line',
          data: [
            [TIMELINE_START, REF_LOW],
            [records[records.length - 1].date, REF_LOW],
          ],
          // 必须绑定右轴（比值轴）：缺省绑到左轴（指数点位刻度）时，
          // markLine 的 0.3/0.7 会按点位量级定位而贴近横轴，且 0.3 恒定值会拖坏左轴缩放
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
            label: { show: false }, // 参考线说明移至图例行，避免悬浮文字遮挡曲线
            lineStyle: { type: 'dashed', width: 1.2 },
            data: [
              {
                yAxis: REF_LOW,
                lineStyle: { color: LOW, shadowColor: 'rgba(32,169,123,0.35)', shadowBlur: 6 },
                label: {
                  formatter: '0.300 历史低位参考',
                  color: LOW,
                  fontSize: 10,
                  position: 'insideEndTop',
                  distance: 5,
                },
              },
              {
                yAxis: REF_HIGH,
                lineStyle: { color: HIGH, shadowColor: 'rgba(230,91,100,0.35)', shadowBlur: 6 },
                label: {
                  formatter: '0.700 历史高位参考',
                  color: HIGH,
                  fontSize: 10,
                  position: 'insideEndTop',
                  distance: 5,
                },
              },
            ],
          },
        },
        {
          name: '创业板指数',
          type: 'line',
          data: records.map((r) => [r.date, r.chinextClose]),
          showSymbol: false,
          lineStyle: { width: 1.4, color: BLUE },
          itemStyle: { color: BLUE },
          color: BLUE,
          z: 2,
        },
        {
          name: '创业板/中证红利',
          type: 'line',
          data: records.map((r) => [r.date, r.ratio]),
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { width: 2.2, color: GOLD },
          itemStyle: { color: GOLD },
          color: GOLD,
          z: 3,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(197,164,109,0.16)' },
              { offset: 1, color: 'rgba(197,164,109,0)' },
            ]),
          },
          // 全历史极值标记（绿色最低 / 红色最高），随缩放裁切，仅可见区间内显示
          markPoint: {
            silent: false,
            animation: false,
            symbol: 'circle',
            symbolSize: 9,
            itemStyle: { borderColor: '#FFFFFF', borderWidth: 1.5 },
            label: { show: false },
            emphasis: { scale: 1.5 },
            data: [
              { coord: [extremes.low.date, extremes.low.ratio], itemStyle: { color: LOW } },
              { coord: [extremes.high.date, extremes.high.ratio], itemStyle: { color: HIGH } },
            ],
          },
        },
        // 参考线图例说明（空数据系列，仅用于图例展示；开关不影响真实参考线）
        {
          name: '0.300 低位参考',
          type: 'line',
          data: [],
          itemStyle: { color: LOW },
          lineStyle: { color: LOW, type: 'dashed' },
          color: LOW,
          silent: true,
          legendHoverLink: false,
        },
        {
          name: '0.700 高位参考',
          type: 'line',
          data: [],
          itemStyle: { color: HIGH },
          lineStyle: { color: HIGH, type: 'dashed' },
          color: HIGH,
          silent: true,
          legendHoverLink: false,
        },
      ],
    }
    return option as ChartOption
  }, [records, extremes, recordMap, reducedMotion, coarse, isWide])

  // 构建 / 重建图表（数据刷新时整体重建；缩放窗口与图例状态保留）
  useEffect(() => {
    const dom = domRef.current
    if (!dom || records.length === 0) return
    let chart: ChartInstance | null = null
    try {
      chart = echarts.init(dom, undefined, { renderer: 'canvas' })
      chart.setOption(buildOption(), true)
      chart.on('legendselectchanged', (e: unknown) => {
        const selected = (e as { selected?: Record<string, boolean> }).selected
        if (selected) legendRef.current = { ...selected }
      })
      chart.on('dataZoom', () => {
        const opt = chart!.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> }
        const dz = opt.dataZoom?.[0]
        if (dz && typeof dz.start === 'number' && typeof dz.end === 'number') {
          zoomRef.current = { start: dz.start, end: dz.end }
        }
      })
      chart.on('click', (p: unknown) => {
        const params = p as { componentType?: string; data?: { coord?: unknown[] } }
        if (params.componentType === 'markPoint' && Array.isArray(params.data?.coord)) {
          const date = String(params.data?.coord?.[0]).slice(0, 10)
          const rec = recordMap.get(date)
          if (rec) setExtreme({ kind: rec.date === extremes.low.date ? 'low' : 'high', rec })
        }
      })
      chart.on('dblclick', () => resetZoom())
    } catch (e) {
      // 图表初始化/配置异常时给出友好提示，绝不让整个页面白屏
      setInitError(e instanceof Error ? e.message : '图表初始化失败，请刷新页面重试')
      try {
        chart?.dispose()
      } catch {
        // 忽略销毁异常
      }
      return
    }
    const instance = chart as ChartInstance
    setInitError(null)
    chartRef.current = instance
    // ResizeObserver 缺失（极旧 WebView）时降级为 window resize 监听
    const onWinResize = () => instance.resize()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => instance.resize())
      ro.observe(dom)
    } else {
      window.addEventListener('resize', onWinResize)
    }
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', onWinResize)
      instance.dispose()
      if (chartRef.current === instance) chartRef.current = null
    }
  }, [buildOption, records.length, recordMap, extremes, resetZoom])

  // 快捷时间范围：仅更新 dataZoom 窗口（时间轴从 2009-10-30 起，“全部”窗口覆盖完整时间轴）
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || records.length === 0) return
    const last = records[records.length - 1].date
    const first = records[0].date
    let startValue = TIMELINE_START
    if (rangeKey !== 'all') {
      const years = rangeKey === '1y' ? 1 : rangeKey === '3y' ? 3 : 5
      startValue = laterDate(shiftYearsISO(last, -years), first)
    }
    const zoom = { startValue, endValue: last }
    try {
      chart.setOption({ dataZoom: [zoom, zoom] } as ChartOption)
    } catch (e) {
      setInitError(e instanceof Error ? e.message : '图表更新失败')
    }
  }, [rangeKey, records])

  // 坐标刻度（年/月/日）：只改横轴刻度粒度与日期格式，不动缩放窗口，绘图始终是原始交易日数据
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || records.length === 0) return
    const label = {
      hideOverlap: true,
      color: MUTED,
      fontSize: 11,
      formatter: makeAxisFormatter(granularity),
    }
    try {
      chart.setOption({ xAxis: [{ axisLabel: label }] } as ChartOption)
    } catch (e) {
      setInitError(e instanceof Error ? e.message : '图表更新失败')
    }
  }, [granularity, records])

  // 按钮行独立于图表上方（不悬浮遮挡曲线）；全屏下图表格子拉伸铺满
  const chartShellClass = isFullscreen ? 'w-full min-h-0 flex-1' : 'h-[400px] w-full md:h-[560px]'

  return (
    <div className={isFullscreen ? 'relative flex h-full w-full flex-col' : 'relative'}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <TimeRangeSelector
          granularity={granularity}
          rangeKey={rangeKey}
          onGranularityChange={onGranularityChange}
          onRangeChange={onRangeChange}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetZoom}
            title="重置时间范围（恢复完整区间）"
            aria-label="重置时间范围"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-[#5A6B85] shadow-sm transition-colors hover:border-[#C9D2E0] hover:text-ink md:h-9 md:w-9"
          >
            <RotateCcw size={15} />
          </button>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? '退出全屏（ESC）' : '全屏查看走势图'}
              aria-label={isFullscreen ? '退出全屏' : '全屏查看走势图'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-[#5A6B85] shadow-sm transition-colors hover:border-[#C9D2E0] hover:text-ink md:h-9 md:w-9"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
        </div>
      </div>
      {initError ? (
        <div
          className={`flex w-full items-center justify-center px-4 text-center text-sm text-muted ${
            isFullscreen ? 'min-h-0 flex-1' : 'h-[400px] md:h-[560px]'
          }`}
        >
          图表初始化失败：{initError}（请刷新页面重试）
        </div>
      ) : (
        <div ref={domRef} className={chartShellClass} />
      )}
      {extreme && !initError && (
        <div className="absolute right-2 top-[54px] z-10 w-60 rounded-xl border border-line bg-white/95 p-3 shadow-pop backdrop-blur md:top-12">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${extreme.kind === 'low' ? 'text-zone-low' : 'text-zone-high'}`}>
              {extreme.kind === 'low' ? '全历史最低比值' : '全历史最高比值'}
            </span>
            <button
              type="button"
              aria-label="关闭极值信息"
              onClick={() => setExtreme(null)}
              className="text-muted transition-colors hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
          <dl className="mt-2 space-y-1 text-[11px] tabular-nums">
            <div className="flex justify-between">
              <dt className="text-muted">日期</dt>
              <dd className="font-medium">{extreme.rec.date}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">创业板指数</dt>
              <dd className="font-medium">{fmtPoint(extreme.rec.chinextClose)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">中证红利</dt>
              <dd className="font-medium">{fmtPoint(extreme.rec.dividendClose)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">当日比值</dt>
              <dd className="font-semibold text-gold">{fmtRatio(extreme.rec.ratio)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[10px] leading-4 text-muted">历史极值仅供研究参考，不代表未来买卖点。</p>
        </div>
      )}
    </div>
  )
}
