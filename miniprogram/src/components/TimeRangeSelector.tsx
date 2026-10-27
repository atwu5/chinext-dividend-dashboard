import { Text, View } from '@tarojs/components'
import { GRANULARITY_OPTIONS, RANGE_OPTIONS, type Granularity, type RangeKey } from '../services/chartOption'
import './TimeRangeSelector.scss'

interface Props {
  granularity: Granularity
  rangeKey: RangeKey
  onGranularityChange: (g: Granularity) => void
  onRangeChange: (r: RangeKey) => void
}

/**
 * 两组独立控制（语义与 Web 端 TimeRangeSelector 一致，不能混为一谈）：
 * - 坐标刻度（年/月/日）：仅调整横轴刻度粒度与日期展示格式，绘图始终使用原始有效交易日数据
 * - 快捷时间范围（近1年/近3年/近5年/全部）：切换实际可见时间窗口
 */
export default function TimeRangeSelector({ granularity, rangeKey, onGranularityChange, onRangeChange }: Props) {
  return (
    <View className='trs-root'>
      <View className='trs-group'>
        <Text className='trs-label'>坐标刻度</Text>
        {GRANULARITY_OPTIONS.map((o) => (
          <Text
            key={o.value}
            className={`trs-btn ${granularity === o.value ? 'trs-btn-active' : ''}`}
            onClick={() => onGranularityChange(o.value)}
          >
            {o.label}
          </Text>
        ))}
      </View>
      <View className='trs-group'>
        <Text className='trs-label'>时间范围</Text>
        {RANGE_OPTIONS.map((o) => (
          <Text
            key={o.value}
            className={`trs-btn ${rangeKey === o.value ? 'trs-btn-active' : ''}`}
            onClick={() => onRangeChange(o.value)}
          >
            {o.label}
          </Text>
        ))}
      </View>
    </View>
  )
}
