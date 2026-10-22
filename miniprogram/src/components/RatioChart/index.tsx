/**
 * 比值折线图：echarts 5（按需引入）+ Canvas 2D。
 * 与 Web 端同用 echarts 5 与 shared/indices 的参考线口径。
 * 小程序没有 DOM，这里把 wx canvas 节点包一层仿 DOM 交给 echarts.init，
 * 触控事件参照 echarts-for-weapp 的 ec-canvas 做法，经 zrender handler.dispatch 手动转发，
 * 从而支持 tooltip 与 dataZoom 拖拽。交互手感需在微信开发者工具/真机验证。
 */
import { useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { Canvas } from '@tarojs/components'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsType, EChartsCoreOption } from 'echarts/core'
import type { DailyRecord } from '../../../../shared/types'
import { REF_HIGH, REF_LOW } from '../../../../shared/indices'
import { fmtRatio } from '../../../../src/utils/calculations' // 临时跨目录引用：合并回 main 时 calculations 迁入 shared/ 后统一改路径

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer])

/** zrender 默认 measureText 会用 document 新建离屏 canvas，小程序里改为用离屏画布上下文测量 */
let measureCtx: any = null
function getMeasureContext(): any {
  if (!measureCtx) {
    const canvas = Taro.createOffscreenCanvas({ type: '2d', width: 200, height: 40 })
    measureCtx = canvas.getContext('2d')
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

const LINE_COLOR = '#5A6B85'

function buildOption(records: DailyRecord[]): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: 48, right: 16, top: 24, bottom: 64 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => fmtRatio(Number(value)),
    },
    xAxis: {
      type: 'time',
      axisLabel: { hideOverlap: true, fontSize: 10 },
      axisLine: { lineStyle: { color: '#C6CFDB' } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 10, formatter: (v: number) => v.toFixed(2) },
      splitLine: { lineStyle: { color: '#E4E9F2' } },
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', height: 20, bottom: 10, borderColor: '#E4E9F2' },
    ],
    series: [
      {
        name: '创业板指/中证红利',
        type: 'line',
        showSymbol: false,
        data: records.map((r) => [r.date, r.ratio]),
        lineStyle: { width: 1.5, color: LINE_COLOR },
        itemStyle: { color: LINE_COLOR },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { fontSize: 10 },
          data: [
            {
              yAxis: REF_LOW,
              lineStyle: { color: '#20A97B', type: 'dashed' },
              label: { formatter: `低位参考 ${REF_LOW.toFixed(3)}`, position: 'insideEndTop' },
            },
            {
              yAxis: REF_HIGH,
              lineStyle: { color: '#E65B64', type: 'dashed' },
              label: { formatter: `高位参考 ${REF_HIGH.toFixed(3)}`, position: 'insideEndTop' },
            },
          ],
        },
      },
    ],
  }
}

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

interface TouchLike {
  x?: number
  y?: number
  clientX?: number
  clientY?: number
}

interface RatioChartProps {
  records: DailyRecord[]
}

export default function RatioChart({ records }: RatioChartProps) {
  const chartRef = useRef<EChartsType | null>(null)
  const offsetRef = useRef({ left: 0, top: 0 })
  const canvasId = 'ratio-chart-canvas'

  useEffect(() => {
    let disposed = false
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

        const chart = echarts.init(createWxDom(node, width, height), undefined, {
          width,
          height,
          devicePixelRatio: dpr,
        })
        chartRef.current = chart
        chart.setOption(buildOption(records))
      })
    return () => {
      disposed = true
      chartRef.current?.dispose()
      chartRef.current = null
    }
    // records 变化（首次加载/刷新换版本）时整图重建，行为与 Web 端一致
  }, [records])

  /** 触控 → zrender 事件（mousedown/mousemove/mouseup），驱动 tooltip 与 dataZoom */
  const dispatchTouch = (type: 'mousedown' | 'mousemove' | 'mouseup', touches?: TouchLike[], changedTouches?: TouchLike[]) => {
    const chart = chartRef.current
    if (!chart) return
    const touch = (touches && touches[0]) || (changedTouches && changedTouches[0])
    if (!touch) return
    const x = typeof touch.x === 'number' ? touch.x : (touch.clientX || 0) - offsetRef.current.left
    const y = typeof touch.y === 'number' ? touch.y : (touch.clientY || 0) - offsetRef.current.top
    chart.getZr().handler.dispatch(type, { zrX: x, zrY: y })
  }

  return (
    <Canvas
      type='2d'
      id={canvasId}
      canvasId={canvasId}
      style={{ width: '100%', height: '560rpx' }}
      onTouchStart={(e) => dispatchTouch('mousedown', e.touches, e.changedTouches)}
      onTouchMove={(e) => dispatchTouch('mousemove', e.touches, e.changedTouches)}
      onTouchEnd={(e) => dispatchTouch('mouseup', e.touches, e.changedTouches)}
    />
  )
}
