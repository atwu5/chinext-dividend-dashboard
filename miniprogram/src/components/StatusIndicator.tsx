import { Text, View } from '@tarojs/components'
import { zoneStyleOf } from '../../../shared/calculations'
import './StatusIndicator.scss'

interface Props {
  ratio: number
  size?: 'sm' | 'md'
}

/** 参考区域状态胶囊：≤0.300 绿 / 0.300–0.700 中性 / ≥0.700 红 */
export default function StatusIndicator({ ratio, size = 'md' }: Props) {
  const style = zoneStyleOf(ratio)
  return (
    <View className={`si-root ${size === 'sm' ? 'si-sm' : ''}`} style={{ color: style.color, backgroundColor: `${style.color}1F` }}>
      <View className='si-dot' style={{ backgroundColor: style.color }} />
      <Text className='si-text'>{style.label}</Text>
    </View>
  )
}
