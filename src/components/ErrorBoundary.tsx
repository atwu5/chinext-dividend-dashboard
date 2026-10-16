import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 全局错误边界：任何渲染期异常都以友好错误卡呈现并可重新加载，
 * 绝不让整页白屏（手机端尤其依赖这一点）。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] 页面渲染异常：', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-page px-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 text-center shadow-card">
            <AlertTriangle size={28} className="mx-auto text-zone-high" />
            <h1 className="mt-3 text-sm font-semibold">页面渲染出现异常</h1>
            <p className="mt-1.5 break-words text-xs leading-5 text-muted">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              <RefreshCw size={13} /> 重新加载页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
