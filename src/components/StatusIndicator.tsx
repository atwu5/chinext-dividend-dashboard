import { zoneStyleOf } from '../utils/calculations'

interface Props {
  ratio: number
  size?: 'sm' | 'md'
}

/** 参考区域状态胶囊：≤0.300 绿 / 0.300–0.700 中性 / ≥0.700 红 */
export default function StatusIndicator({ ratio, size = 'md' }: Props) {
  const style = zoneStyleOf(ratio)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ color: style.color, backgroundColor: `${style.color}1F` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
      {style.label}
    </span>
  )
}
