import { Info } from 'lucide-react'
import type { Metadata } from '../../shared/types'

interface Props {
  meta: Metadata
  onOpenModal: () => void
}

/** 页面底部固定入口：指标说明与风险提示 */
export default function Footer({ meta, onOpenModal }: Props) {
  return (
    <footer className="border-t border-line bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2.5 px-4 py-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-center sm:px-6">
        <button
          type="button"
          onClick={onOpenModal}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-xs font-medium text-[#5A6B85] transition-colors hover:border-[#C9D2E0] hover:text-ink"
        >
          <Info size={14} /> 指标说明与风险提示
        </button>
        <p className="text-[11px] leading-5 text-muted">
          本工具仅供个人研究、历史数据观察及市场风格分析使用，不构成证券、基金投资建议。
          <br />
          数据截至 {meta.lastDate}（收盘）
        </p>
      </div>
    </footer>
  )
}
