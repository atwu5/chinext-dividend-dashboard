import { useCallback } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import RatioChart from '../../components/RatioChart'
import { useMarketData } from '../../hooks/useMarketData'
import {
  fmtPct,
  fmtRatio,
  latestPct,
  ratioPositionPct,
  zoneStyleOf,
} from '../../../../src/utils/calculations' // 临时跨目录引用：合并回 main 时 calculations 迁入 shared/ 后统一改路径

import './index.scss'

export default function Index() {
  const { status, data, error, refreshing, reload } = useMarketData()

  const onReload = useCallback(async () => {
    const result = await reload()
    Taro.showToast({ title: result.message, icon: 'none', duration: 2200 })
  }, [reload])

  if (status === 'loading') {
    return (
      <View className='page'>
        <View className='card skeleton'>加载行情数据…</View>
      </View>
    )
  }

  if (status === 'error' || !data) {
    return (
      <View className='page'>
        <View className='card error'>
          <View className='error-title'>数据加载失败</View>
          <View className='error-msg'>{error}</View>
          <Button className='retry' size='mini' onClick={onReload}>重试</Button>
        </View>
      </View>
    )
  }

  const { meta, records } = data
  const last = records[records.length - 1]
  const zone = zoneStyleOf(last.ratio)
  const pos = ratioPositionPct(last.ratio)

  return (
    <View className='page'>
      <View className='meta-bar'>
        <Text className='meta-text'>
          数据截至 {meta.lastDate} · v{meta.version} · {meta.count} 个交易日
        </Text>
        <Text className='meta-refresh' onClick={onReload}>
          {refreshing ? '刷新中…' : '刷新'}
        </Text>
      </View>

      <View className='card hero'>
        <View className='hero-label'>创业板指 / 中证红利 最新比值</View>
        <View className='hero-value' style={{ color: zone.color }}>{fmtRatio(last.ratio)}</View>
        <View className='hero-zone' style={{ color: zone.color }}>
          {zone.label} · 区间位置 {pos.toFixed(0)}%
        </View>
      </View>

      <View className='card stats'>
        <View className='stat'>
          <View className='stat-label'>创业板指（最新交易日）</View>
          <View className='stat-value'>{fmtPct(latestPct(records, 'chinextClose'))}</View>
        </View>
        <View className='stat'>
          <View className='stat-label'>中证红利（最新交易日）</View>
          <View className='stat-value'>{fmtPct(latestPct(records, 'dividendClose'))}</View>
        </View>
      </View>

      <View className='card chart-card'>
        <View className='chart-title'>历史比值走势</View>
        <RatioChart records={records} />
      </View>

      <View className='footer'>
        数据来源：{meta.sourceName} · 仅保留两指数同日收盘的交易日
      </View>
    </View>
  )
}
