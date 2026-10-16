import { AlertTriangle, RefreshCw } from 'lucide-react'

/** 页面级错误态：JSON 加载失败、版本不一致、网络中断等，提供明确原因与重试 */
export default function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-card p-6 text-center shadow-card">
      <AlertTriangle size={28} className="mx-auto text-zone-high" />
      <h2 className="mt-3 text-sm font-semibold">数据加载失败</h2>
      <p className="mt-1.5 break-words text-xs leading-5 text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        <RefreshCw size={13} /> 重试
      </button>
    </div>
  )
}
