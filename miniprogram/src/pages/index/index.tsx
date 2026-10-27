/**
 * 首页：与 Web 端 App 布局逐块对齐
 * （指标卡 → 主图卡[标题/极值副标题/时间控制/图例/画布] → 页脚 → 悬浮说明按钮 → 说明弹窗）
 */
import { useCallback, useMemo, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import ExplanationModal from '../../components/ExplanationModal'
import MetricCards from '../../components/MetricCards'
import RatioChart from '../../components/RatioChart'
import { useMarketData } from '../../hooks/useMarketData'
import type { Granularity, RangeKey } from '../../services/chartOption'
import { fmtRatio } from '../../../../shared/calculations'
import './index.scss'

export default function Index() {
  const { status, data, error, refreshing, reload } = useMarketData()
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [rangeKey, setRangeKey] = useState<RangeKey>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const handleRefresh = useCallback(async () => {
    const result = await reload()
    Taro.showToast({ title: result.message, icon: 'none', duration: 2600 })
  }, [reload])

  const records = useMemo(() => data?.records ?? [], [data])
  const extremes = useMemo(() => {
    if (records.length === 0) return null
    const low = records.reduce((a, b) => (b.ratio < a.ratio ? b : a))
    const high = records.reduce((a, b) => (b.ratio > a.ratio ? b : a))
    return { low, high }
  }, [records])

  if (status === 'loading') {
    return (
      <View className='page'>
        <View className='card skeleton'>加载行情数据…</View>
      </View>
    )
  }

  if (status === 'error' || !data || !extremes) {
    return (
      <View className='page'>
        <View className='card error'>
          <View className='error-title'>数据加载失败</View>
          <View className='error-msg'>{error}</View>
          <Button className='retry' size='mini' onClick={handleRefresh}>重试</Button>
        </View>
      </View>
    )
  }

  return (
    <View className='page'>
      <View className='meta-bar'>
        <Text className='meta-text'>
          数据截至 {data.meta.lastDate} · v{data.meta.version} · {data.meta.count} 个交易日
        </Text>
        <Text className='meta-refresh' onClick={handleRefresh}>
          {refreshing ? '刷新中…' : '刷新'}
        </Text>
      </View>

      <MetricCards records={records} />

      <View className='card chart-card'>
        <View className='chart-head'>
          <Text className='chart-title'>历史走势与相对比值</Text>
          <Text className='chart-sub'>
            全历史极值：最低 {fmtRatio(extremes.low.ratio)}（{extremes.low.date}）· 最高 {fmtRatio(extremes.high.ratio)}（{extremes.high.date}）
          </Text>
        </View>
        <RatioChart
          records={records}
          granularity={granularity}
          onGranularityChange={setGranularity}
          rangeKey={rangeKey}
          onRangeChange={setRangeKey}
          heightPx={380}
          onToggleFullscreen={() => Taro.navigateTo({ url: '/pages/fullchart/index' })}
        />
      </View>

      <View className='footer'>
        <View className='footer-btn' onClick={() => setModalOpen(true)}>
          <Text className='footer-btn-text'>指标说明与风险提示</Text>
        </View>
        <Text className='footer-text'>
          本工具仅供个人研究、历史数据观察及市场风格分析使用，不构成证券、基金投资建议。
        </Text>
        <Text className='footer-text'>
          数据来源：{data.meta.sourceName} · 数据截至 {data.meta.lastDate}（收盘）
        </Text>
      </View>

      <View className='fab' onClick={() => setModalOpen(true)}>
        <Text className='fab-text'>i</Text>
      </View>

      <ExplanationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </View>
  )
}
