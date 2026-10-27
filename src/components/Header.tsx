import { RefreshCw } from 'lucide-react'
import type { Metadata } from '../../shared/types'
import { fmtDateTimeCn } from '../../shared/format'

interface Props {
  meta: Metadata
  refreshing: boolean
  onRefresh: () => void
}

function StatusDot({ color, title }: { color: string; title: string }) {
  return <span title={title} className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

/**
 * 页面顶部：标题 + 副标题；右侧数据状态（数据截至 / 来源 / 版本 / 刷新入口）。
 * 刷新按钮仅重新检查「已部署的数据版本」并读取最新文件，不直接请求交易所行情。
 */
export default function Header({ meta, refreshing, onRefresh }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-3 pt-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight md:text-xl">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[4px] bg-gold" />
            创业板 · 红利风格观察仪表盘
          </h1>
          <p className="mt-0.5 text-xs text-muted md:text-[13px]">基于历史指数相对强弱，观察成长与红利风格变化。</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <span
            className="inline-flex items-center gap-1.5"
            title={`数据来源：${meta.sourceName} · 版本 v${meta.version} · 更新时间 ${fmtDateTimeCn(meta.lastUpdated)}`}
          >
            <StatusDot color="#20A97B" title="数据加载正常" />
            <span className="tabular-nums">
              数据截至：<b className="font-semibold text-ink">{meta.lastDate}</b>（收盘）
            </span>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="重新检查已部署的数据版本"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 font-medium text-[#5A6B85] transition-colors hover:border-[#C9D2E0] hover:text-ink disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            刷新数据
          </button>
        </div>
      </div>
    </header>
  )
}
