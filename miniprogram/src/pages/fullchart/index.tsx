/**
 * 全屏走势页：与 Web 端「一键全屏横屏查看」对齐。
 * - 页面配置 pageOrientation: 'auto'（微信端生效：物理/页面横屏直接铺满）
 * - 平台不支持横屏时：整卡 rotate(90deg) 模拟横屏（与 Web 端 iPhone 兜底同思路），
 *   RatioChart 的 rotated 模式按旋转公式换算触点坐标
 * - 数据直接读运行内存缓存（从首页进入时已加载），不重复请求
 */
import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import ErrorBoundary from '../../components/ErrorBoundary'
import RatioChart from '../../components/RatioChart'
import { cachedDashboardData } from '../../services/marketData/loader'
import type { Granularity, RangeKey } from '../../services/chartOption'
import './index.scss'

export default function FullChart() {
  const data = cachedDashboardData()
  const [win, setWin] = useState(() => {
    const info = Taro.getSystemInfoSync()
    return { windowWidth: info.windowWidth, windowHeight: info.windowHeight }
  })
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [rangeKey, setRangeKey] = useState<RangeKey>('all')

  useEffect(() => {
    const handler = (res: any) => {
      setWin({ windowWidth: res.windowWidth, windowHeight: res.windowHeight })
    }
    Taro.onWindowResize?.(handler)
    return () => {
      Taro.offWindowResize?.(handler)
    }
  }, [])

  if (!data) {
    return (
      <View className='fc-empty'>
        <Text className='fc-empty-text'>数据未加载，请从首页进入全屏</Text>
      </View>
    )
  }

  const landscape = win.windowWidth > win.windowHeight
  const rotated = !landscape
  // 顶栏 48px + RatioChart 内部工具行/图例约 130px
  const canvasHeight = (landscape ? win.windowHeight : win.windowWidth) - 48 - 130

  return (
    <ErrorBoundary>
    <View
      className={`fc-root ${rotated ? 'fc-rotated' : ''}`}
      style={rotated ? { width: `${win.windowHeight}px`, height: `${win.windowWidth}px` } : undefined}
    >
      <View className='fc-topbar'>
        <Text className='fc-exit' onClick={() => Taro.navigateBack()}>‹ 退出全屏</Text>
        <Text className='fc-title'>创业板/中证红利 · 全屏走势</Text>
      </View>
      <RatioChart
        records={data.records}
        granularity={granularity}
        onGranularityChange={setGranularity}
        rangeKey={rangeKey}
        onRangeChange={setRangeKey}
        isFullscreen
        rotated={rotated}
        heightPx={canvasHeight}
      />
    </View>
    </ErrorBoundary>
  )
}
