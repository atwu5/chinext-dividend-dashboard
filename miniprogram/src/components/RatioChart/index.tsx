/**
 * 主图组件：对齐 Web 端 MainChart 的交互。
 * - 图例 chips（两条曲线可点击显隐；参考线两项为静态说明）
 * - 全历史极值圆点，点击弹出当日两指数点位与比值卡片
 * - 触控浮层：小程序无 DOM，echarts HTML tooltip 改为 Taro 自绘浮层 + 十字竖线
 *   （只展示真实行情记录，缺失日期不编造，与 Web 口径一致）
 * - 双击重置缩放；重置/全屏按钮与 Web 工具行一致
 * 触控事件经 zrender handler.dispatch 转发（mousedown/mouseup 驱动 click 合成）；
 * 拖拽平移走底部 slider，与 Web 移动端「单指走滑块」行为一致。
 * 全屏页 CSS 旋转兜底（rotated 模式）时触点坐标按旋转公式换算。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import type { DailyRecord } from '../../../../shared/types'
import { fmtDateUTC, fmtPoint } from '../../../../shared/format'
import { fmtRatio, zoneStyleOf } from '../../../../shared/calculations'
import {
  CHART_COLORS,
  buildMainChartOption,
  makeAxisFormatter,
  rangeStartValue,
  type Granularity,
  type RangeKey,
} from '../../services/chartOption'
import TimeRangeSelector from '../TimeRangeSelector'
import './index.scss'

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
])

/** zrender 默认 measureText 会用 document 新建离屏 canvas，小程序里改为用离屏画布上下文测量 */
let measureCtx: any = null
function getMeasureContext(): any {
  if (!measureCtx) {
    try {
      const canvas = Taro.createOffscreenCanvas({ type: '2d', width: 200, height: 40 })
      measureCtx = canvas.getContext('2d')
    } catch (e) {
      measureCtx = null
    }
  }
  if (!measureCtx) {
    // 抖音等平台低版本基础库无离屏画布时，退化为字符数估算（真机回归时改为主画布上下文测量）
    measureCtx = {
      font: '',
      measureText: (text: string) => ({ width: String(text).length * 12 }),
    }
  }
  return measureCtx
}
echarts.setPlatformAPI({
  measureText: (text: string, font?: string) => {
    const ctx = getMeasureContext()
    if (font) ctx.font = font
    return { width: ctx.measureText(text).width }
  },
})

/** wx canvas 节点的仿 DOM 包装：补齐 zrender 需要的最小 DOM 接口 */
function createWxDom(node: any, width: number, height: number) {
  const listeners: Record<string, Array<(evt: unknown) => void>> = {}
  return {
    node,
    nodeType: 1,
    nodeName: 'CANVAS',
    tagName: 'CANVAS',
    style: {},
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    getContext: (type: string) => node.getContext(type),
    addEventListener: (type: string, listener: (evt: unknown) => void) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(listener)
    },
    removeEventListener: (type: string, listener: (evt: unknown) => void) => {
      listeners[type] = (listeners[type] || []).filter((l) => l !== listener)
    },
    dispatchEvent: (evt: { type: string }) => {
      ;(listeners[evt.type] || []).forEach((l) => l(evt))
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    setAttribute: () => undefined,
    getAttribute: () => undefined,
  } as any
}

const LEGEND_ITEMS = [
  { name: '创业板指数', color: CHART_COLORS.BLUE, dashed: false, interactive: true },
  { name: '创业板/中证红利', color: CHART_COLORS.GOLD, dashed: false, interactive: true },
  { name: '0.300 低位参考', color: CHART_COLORS.LOW, dashed: true, interactive: false },
  { name: '0.700 高位参考', color: CHART_COLORS.HIGH, dashed: true, interactive: false },
] as const

interface TouchLike {
  x?: number
  y?: number
  clientX?: number
  clientY?: number
}

interface TooltipState {
  left: number
  top: number
  date: string
  rec: DailyRecord | null
}

interface ExtremeState {
  kind: 'low' | 'high'
  rec: DailyRecord
}

interface RatioChartProps {
  records: DailyRecord[]
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  rangeKey: RangeKey
  onRangeChange: (r: RangeKey) => void
  /** 全屏页内为 true：隐藏全屏按钮 */
  isFullscreen?: boolean
  /** 画布高度（px），默认 400 */
  heightPx?: number
  /** 进入/退出全屏（未提供则不显示全屏按钮） */
  onToggleFullscreen?: () => void
  /** 全屏页 CSS 旋转兜底模式：触点坐标按旋转公式换算 */
  rotated?: boolean
}

export default function RatioChart({
  records,
  granularity,
  onGranularityChange,
  rangeKey,
  onRangeChange,
  isFullscreen = false,
  heightPx = 400,
  onToggleFullscreen,
  rotated = false,
}: RatioChartProps) {
  const canvasId = 'main-ratio-chart'
  const chartRef = useRef<EChartsType | null>(null)
  const offsetRef = useRef({ left: 0, top: 0 })
  const rotRectRef = useRef({ left: 0, top: 0, width: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const rotatedRef = useRef(rotated)
  rotatedRef.current = rotated
  const zoomRef = useRef<{ start?: number; end?: number } | null>(null)
  const lastTapRef = useRef(0)
  const lastCrossRef = useRef(0)
  const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({
    创业板指数: true,
    '创业板/中证红利': true,
    '0.300 低位参考': true,
    '0.700 高位参考': true,
  })
  const legendRef = useRef(legendSelected)
  const [extreme, setExtreme] = useState<ExtremeState | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  const recordMap = useMemo(() => new Map(records.map((r) => [r.date, r])), [records])
  const extremes = useMemo(() => {
    if (records.length === 0) return null
    let low = records[0]
    let high = records[0]
    for (const r of records) {
      if (r.ratio < low.ratio) low = r
      if (r.ratio > high.ratio) high = r
    }
    return { low, high }
  }, [records])

  const resetZoom = () => {
    const chart = chartRef.current
    if (!chart) return
    try {
      chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 } as never)
      zoomRef.current = { start: 0, end: 100 }
    } catch {
      // 忽略重置异常
    }
  }

  const toggleLegend = (name: string) => {
    const chart = chartRef.current
    if (!chart) return
    try {
      chart.dispatchAction({ type: 'legendToggleSelect', name } as never)
    } catch {
      // 忽略图例切换异常
    }
  }

  // 构建 / 重建图表（数据刷新时整体重建；缩放窗口与图例状态保留）
  useEffect(() => {
    if (records.length === 0 || !extremes) return
    let disposed = false
    try {
    Taro.createSelectorQuery()
      .select(`#${canvasId}`)
      .fields({ node: true, size: true, rect: true })
      .exec((res) => {
        if (disposed) return
        const info = res && res[0]
        if (!info || !info.node) return
        const node = info.node as any
        const width: number = info.width
        const height: number = info.height
        const dpr: number = Taro.getSystemInfoSync().pixelRatio || 2
        node.width = width * dpr
        node.height = height * dpr
        offsetRef.current = { left: info.left || 0, top: info.top || 0 }
        // 旋转模式：fields 返回的 rect 是变换后 AABB（left/top=元素原点，width=画布布局高度）
        rotRectRef.current = { left: info.left || 0, top: info.top || 0, width: info.width }
        sizeRef.current = rotatedRef.current
          ? { w: info.height, h: info.width }
          : { w: width, h: height }

        try {
          const chart = echarts.init(createWxDom(node, width, height), undefined, {
            width,
            height,
            devicePixelRatio: dpr,
          })
          chartRef.current = chart
          chart.setOption(
            buildMainChartOption({
              records,
              granularity,
              extremes,
              legendSelected: legendRef.current,
              animation: true,
            }),
            true,
          )
          chart.on('legendselectchanged', (e: unknown) => {
            const selected = (e as { selected?: Record<string, boolean> }).selected
            if (selected) {
              legendRef.current = { ...selected }
              setLegendSelected({ ...selected })
            }
          })
          chart.on('dataZoom', () => {
            const opt = chart.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> }
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
          setInitError(null)
        } catch (e) {
          // 图表初始化/配置异常时给出友好提示，绝不让整个页面白屏
          setInitError(e instanceof Error ? e.message : '图表初始化失败，请重新进入页面重试')
          try {
            chartRef.current?.dispose()
          } catch {
            // 忽略销毁异常
          }
          chartRef.current = null
        }
      })
    } catch (e) {
      setInitError(e instanceof Error ? e.message : String(e))
    }
    return () => {
      disposed = true
      try {
        chartRef.current?.dispose()
      } catch {
        // 忽略销毁异常
      }
      chartRef.current = null
    }
    // granularity / legendSelected 变化走独立的 setOption 更新，不重建实例
  }, [records, extremes, heightPx])

  // 坐标刻度（年/月/日）：只改横轴刻度粒度与日期格式，不动缩放窗口
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || records.length === 0) return
    try {
      chart.setOption({
        xAxis: [{ axisLabel: { hideOverlap: true, color: CHART_COLORS.MUTED, fontSize: 11, formatter: makeAxisFormatter(granularity) } }],
      } as EChartsCoreOption)
    } catch {
      // 忽略更新异常
    }
  }, [granularity, records])

  // 快捷时间范围：仅更新 dataZoom 窗口（时间轴从 2009-10-30 起，'全部' 覆盖完整时间轴）
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || records.length === 0) return
    const last = records[records.length - 1].date
    const zoom = { startValue: rangeStartValue(records, rangeKey), endValue: last }
    try {
      chart.setOption({ dataZoom: [zoom, zoom] } as EChartsCoreOption)
    } catch {
      // 忽略更新异常
    }
  }, [rangeKey, records])

  /** 触点 → 画布局部坐标（普通模式优先用画布相对 x/y；旋转模式按 90° 旋转公式换算） */
  const toLocal = (touches?: TouchLike[], changedTouches?: TouchLike[]): { x: number; y: number } | null => {
    const t = (touches && touches[0]) || (changedTouches && changedTouches[0])
    if (!t) return null
    if (rotatedRef.current) {
      // transform: rotate(90deg) + origin top left 下，局部 (u,v) → 视口 (H-v, u)，逆变换如下
      return { x: (t.clientY ?? 0) - rotRectRef.current.top, y: rotRectRef.current.left + rotRectRef.current.width - (t.clientX ?? 0) }
    }
    if (typeof t.x === 'number' && typeof t.y === 'number') return { x: t.x, y: t.y }
    return { x: (t.clientX ?? 0) - offsetRef.current.left, y: (t.clientY ?? 0) - offsetRef.current.top }
  }

  /** 局部坐标 → 最近交易记录 + 浮层位置（浮层避让边缘，越界翻转，与 Web 行为一致） */
  const locateTooltip = (x: number, y: number): TooltipState | null => {
    const chart = chartRef.current
    if (!chart) return null
    let ts: number | null = null
    try {
      const converted = (chart as any).convertFromPixel({ xAxisIndex: 0 }, [x, y])
      const v = Array.isArray(converted) ? converted[0] : converted
      if (typeof v === 'number' && Number.isFinite(v)) ts = v
    } catch {
      return null
    }
    if (ts === null) return null
    const date = fmtDateUTC(ts)
    const rec = recordMap.get(date) ?? null
    const { w, h } = sizeRef.current
    let left = x + 14
    if (left + 170 > w) left = x - 184
    if (left < 8) left = 8
    let top = y - 140
    if (top < 8) top = y + 18
    if (top + 150 > h) top = Math.max(8, h - 158)
    return { left, top, date, rec }
  }

  const updateCrosshair = (rec: DailyRecord | null) => {
    const chart = chartRef.current
    if (!chart) return
    const now = Date.now()
    if (now - lastCrossRef.current < 80) return
    lastCrossRef.current = now
    try {
      chart.setOption({
        series: [{ name: '__crosshair', markLine: { data: rec ? [{ xAxis: rec.date }] : [] } }],
      } as EChartsCoreOption)
    } catch {
      // 忽略十字线更新异常
    }
  }

  const onTouchStart = (e: any) => {
    const local = toLocal(e.touches, e.changedTouches)
    if (!local) return
    const chart = chartRef.current
    try {
      chart?.getZr().handler.dispatch('mousedown', { zrX: local.x, zrY: local.y })
    } catch {
      // 忽略触控转发异常
    }
    setTooltip(locateTooltip(local.x, local.y))
  }

  const onTouchMove = (e: any) => {
    const local = toLocal(e.touches, e.changedTouches)
    if (!local) return
    const state = locateTooltip(local.x, local.y)
    setTooltip(state)
    updateCrosshair(state?.rec ?? null)
  }

  const onTouchEnd = (e: any) => {
    const local = toLocal(e.touches, e.changedTouches)
    if (local) {
      const chart = chartRef.current
      try {
        chart?.getZr().handler.dispatch('mouseup', { zrX: local.x, zrY: local.y })
      } catch {
        // 忽略触控转发异常
      }
    }
    setTooltip(null)
    // 双击重置缩放（Web 端为 dblclick）
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      resetZoom()
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <View className='rc-root'>
      <View className='rc-toolbar'>
        <TimeRangeSelector
          granularity={granularity}
          rangeKey={rangeKey}
          onGranularityChange={onGranularityChange}
          onRangeChange={onRangeChange}
        />
        <View className='rc-tools'>
          <View className='rc-tool-btn' onClick={resetZoom}>
            <Text className='rc-tool-text'>重置</Text>
          </View>
          {onToggleFullscreen && !isFullscreen && (
            <View className='rc-tool-btn' onClick={onToggleFullscreen}>
              <Text className='rc-tool-text'>全屏</Text>
            </View>
          )}
        </View>
      </View>

      <View className='rc-legend'>
        {LEGEND_ITEMS.map((item) => (
          <View
            key={item.name}
            className='rc-legend-item'
            onClick={() => item.interactive && toggleLegend(item.name)}
          >
            {item.dashed ? (
              <View className='rc-legend-dash' style={{ borderTopColor: item.color }} />
            ) : (
              <View className='rc-legend-line' style={{ backgroundColor: item.color }} />
            )}
            <Text
              className='rc-legend-text'
              style={{ color: legendSelected[item.name] ? '#5A6B85' : '#C3CAD6' }}
            >
              {item.name}
            </Text>
          </View>
        ))}
      </View>

      <View className='rc-canvas-wrap' style={{ height: `${heightPx}px` }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <Canvas type='2d' id={canvasId} canvasId={canvasId} style={{ width: '100%', height: '100%' }} />
        {initError && (
          <View className='rc-init-error'>
            <Text className='rc-init-error-text'>图表初始化失败：{initError}</Text>
          </View>
        )}
        {tooltip && (
          <View className='rc-tooltip' style={{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }}>
            <View className='rc-tooltip-date'>{tooltip.date}</View>
            {tooltip.rec ? (
              <>
                <View className='rc-tooltip-row'>
                  <Text className='rc-tooltip-k'>创业板指数</Text>
                  <Text className='rc-tooltip-v'>{fmtPoint(tooltip.rec.chinextClose)}</Text>
                </View>
                <View className='rc-tooltip-row'>
                  <Text className='rc-tooltip-k'>中证红利</Text>
                  <Text className='rc-tooltip-v'>{fmtPoint(tooltip.rec.dividendClose)}</Text>
                </View>
                <View className='rc-tooltip-row'>
                  <Text className='rc-tooltip-k'>相对比值</Text>
                  <Text className='rc-tooltip-v' style={{ color: CHART_COLORS.GOLD }}>{fmtRatio(tooltip.rec.ratio)}</Text>
                </View>
                <View className='rc-tooltip-row'>
                  <Text className='rc-tooltip-k'>相对状态</Text>
                  <Text className='rc-tooltip-v' style={{ color: zoneStyleOf(tooltip.rec.ratio).color }}>
                    {zoneStyleOf(tooltip.rec.ratio).label}
                  </Text>
                </View>
              </>
            ) : (
              <View className='rc-tooltip-empty'>该日期无有效记录</View>
            )}
          </View>
        )}
        {extreme && !initError && (
          <View className='rc-extreme'>
            <View className='rc-extreme-head'>
              <Text
                className='rc-extreme-title'
                style={{ color: extreme.kind === 'low' ? CHART_COLORS.LOW : CHART_COLORS.HIGH }}
              >
                {extreme.kind === 'low' ? '全历史最低比值' : '全历史最高比值'}
              </Text>
              <Text className='rc-extreme-close' onClick={() => setExtreme(null)}>×</Text>
            </View>
            <View className='rc-extreme-row'>
              <Text className='rc-extreme-k'>日期</Text>
              <Text className='rc-extreme-v'>{extreme.rec.date}</Text>
            </View>
            <View className='rc-extreme-row'>
              <Text className='rc-extreme-k'>创业板指数</Text>
              <Text className='rc-extreme-v'>{fmtPoint(extreme.rec.chinextClose)}</Text>
            </View>
            <View className='rc-extreme-row'>
              <Text className='rc-extreme-k'>中证红利</Text>
              <Text className='rc-extreme-v'>{fmtPoint(extreme.rec.dividendClose)}</Text>
            </View>
            <View className='rc-extreme-row'>
              <Text className='rc-extreme-k'>当日比值</Text>
              <Text className='rc-extreme-v' style={{ color: CHART_COLORS.GOLD }}>{fmtRatio(extreme.rec.ratio)}</Text>
            </View>
            <Text className='rc-extreme-note'>历史极值仅供研究参考，不代表未来买卖点。</Text>
          </View>
        )}
      </View>
    </View>
  )
}
