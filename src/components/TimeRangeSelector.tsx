export type Granularity = 'day' | 'month' | 'year'
export type RangeKey = '1y' | '3y' | '5y' | 'all'

const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '1y', label: '近1年' },
  { value: '3y', label: '近3年' },
  { value: '5y', label: '近5年' },
  { value: 'all', label: '全部' },
]

interface Props {
  granularity: Granularity
  rangeKey: RangeKey
  onGranularityChange: (g: Granularity) => void
  onRangeChange: (r: RangeKey) => void
}

function OptionButton({
  active,
  label,
  onClick,
  ariaLabel,
}: {
  active: boolean
  label: string
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`h-11 min-w-[44px] rounded-lg border px-3 text-xs font-medium transition-colors md:h-9 ${
        active
          ? 'border-ink bg-ink text-white shadow-sm'
          : 'border-line bg-white text-[#5A6B85] hover:border-[#C9D2E0] hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * 两组独立控制（不能混为一谈）：
 * - 坐标刻度（年/月/日）：仅调整横轴刻度粒度与日期展示格式，绘图始终使用原始有效交易日数据
 * - 快捷时间范围（近1年/近3年/近5年/全部）：切换实际可见时间窗口
 */
export default function TimeRangeSelector({ granularity, rangeKey, onGranularityChange, onRangeChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1.5" role="group" aria-label="坐标刻度">
        <span className="mr-0.5 text-[11px] text-muted">坐标刻度</span>
        {GRANULARITY_OPTIONS.map((o) => (
          <OptionButton
            key={o.value}
            active={granularity === o.value}
            label={o.label}
            onClick={() => onGranularityChange(o.value)}
            ariaLabel={`坐标刻度：${o.label}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="时间范围">
        <span className="mr-0.5 text-[11px] text-muted">时间范围</span>
        {RANGE_OPTIONS.map((o) => (
          <OptionButton
            key={o.value}
            active={rangeKey === o.value}
            label={o.label}
            onClick={() => onRangeChange(o.value)}
            ariaLabel={`时间范围：${o.label}`}
          />
        ))}
      </div>
    </div>
  )
}
