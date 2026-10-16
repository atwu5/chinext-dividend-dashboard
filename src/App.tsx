import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { Info } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DailyRecord } from '../shared/types'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorState from './components/ErrorState'
import ExplanationModal from './components/ExplanationModal'
import Footer from './components/Footer'
import Header from './components/Header'
import MainChart from './components/MainChart'
import MetricCards from './components/MetricCards'
import Skeleton from './components/Skeleton'
import TimeRangeSelector, { type Granularity, type RangeKey } from './components/TimeRangeSelector'
import Toast, { type ToastData } from './components/Toast'
import { useMarketData } from './hooks/useMarketData'
import { useMediaQuery } from './hooks/useMediaQuery'
import { fmtRatio } from './utils/calculations'
import { enterFullscreen, exitFullscreen, getFullscreenElement, isFullscreenSupported } from './utils/fullscreen'

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
}

export default function App() {
  const { status, data, error, refreshing, reload } = useMarketData()
  const isTouch = useMediaQuery('(pointer: coarse)')
  const isPortrait = useMediaQuery('(orientation: portrait)')
  const reduced = useReducedMotion() ?? false
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [rangeKey, setRangeKey] = useState<RangeKey>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const [realFullscreen, setRealFullscreen] = useState(false)
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false)
  const isChartFullscreen = realFullscreen || pseudoFullscreen

  // 真全屏状态同步：监听标准与 Safari webkit 前缀事件，ESC 退出时也能归位
  useEffect(() => {
    const sync = () => setRealFullscreen(Boolean(getFullscreenElement()))
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  // 模拟全屏（iPhone 等无元素全屏 API 时）：锁定页面滚动 + ESC 退出
  useEffect(() => {
    if (!pseudoFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPseudoFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [pseudoFullscreen])

  const toggleChartFullscreen = useCallback(async () => {
    const el = sectionRef.current
    if (!el) return
    try {
      if (pseudoFullscreen) {
        setPseudoFullscreen(false)
        return
      }
      if (getFullscreenElement()) {
        await exitFullscreen()
        return
      }
      if (isFullscreenSupported(el)) {
        await enterFullscreen(el)
        if (isTouch) {
          // Android 支持在全屏中锁定横屏；iOS 无此 API（抛错），由 CSS 旋转兜底
          const orientation = screen.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>
            unlock?: () => void
          }
          try {
            await orientation.lock?.('landscape')
          } catch {
            // 忽略：走 CSS 旋转兜底
          }
        }
        return
      }
      // iPhone Safari / WKWebView 不支持任意元素全屏 → 覆盖层模拟全屏
      setPseudoFullscreen(true)
    } catch (e: unknown) {
      setToast({
        id: Date.now(),
        message: e instanceof Error && e.message ? e.message : '进入全屏失败',
        tone: 'error',
      })
    }
  }, [pseudoFullscreen, isTouch])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(timer)
  }, [toast])

  const handleRefresh = useCallback(async () => {
    const result = await reload()
    setToast({
      id: Date.now(),
      message: result.message,
      tone: result.ok ? (result.changed ? 'success' : 'neutral') : 'error',
    })
  }, [reload])

  const records: DailyRecord[] = data?.records ?? []
  const extremes = useMemo(() => {
    if (records.length === 0) return null
    const low = records.reduce((a, b) => (b.ratio < a.ratio ? b : a))
    const high = records.reduce((a, b) => (b.ratio > a.ratio ? b : a))
    return { low, high }
  }, [records])

  // 移动端全屏且竖屏时：整卡旋转 90° 模拟横屏（Android 已优先锁定原生横屏，不会走到这里；
  // 用户物理旋转手机到横屏后 isPortrait 翻转，自动恢复正向铺满）
  const rotateLandscape = isChartFullscreen && isPortrait && isTouch

  // 全屏态挂在普通 <section> 上（motion 外置），避免 framer-motion 的内联 transform 干扰 CSS 旋转
  const sectionClassName = rotateLandscape
    ? 'fixed left-0 top-0 z-[70] flex flex-col overflow-hidden rounded-none bg-card p-3 w-[100vh] h-[100vw] supports-[width:100dvh]:w-[100dvh] supports-[height:100dvh]:h-[100dvh] [transform:rotate(90deg)_translateY(-100%)] [transform-origin:top_left]'
    : realFullscreen
      ? 'flex h-full w-full flex-col overflow-hidden rounded-none bg-card p-4'
      : pseudoFullscreen
        ? 'fixed inset-0 z-[70] flex flex-col overflow-hidden rounded-none bg-card p-3'
        : 'mt-4 rounded-2xl border border-line bg-card p-3 shadow-card md:p-4'

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col">
        {data && <Header meta={data.meta} refreshing={refreshing} onRefresh={handleRefresh} />}

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-12 pt-4 sm:px-6">
          {status === 'loading' && <Skeleton />}
          {status === 'error' && <ErrorState message={error ?? '数据加载失败'} onRetry={handleRefresh} />}
          {status === 'ready' && data && records.length > 0 && extremes && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            >
              <motion.div variants={itemVariants}>
                <MetricCards records={records} />
              </motion.div>

              <motion.div variants={itemVariants}>
                <section ref={sectionRef} className={sectionClassName}>
                  {!isChartFullscreen && (
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold md:text-base">历史走势与相对比值</h2>
                      <p className="mt-0.5 text-[11px] leading-5 tabular-nums text-muted">
                        全历史极值：最低 {fmtRatio(extremes.low.ratio)}（{extremes.low.date}）· 最高{' '}
                        {fmtRatio(extremes.high.ratio)}（{extremes.high.date}）
                      </p>
                    </div>
                  )}
                  <TimeRangeSelector
                    granularity={granularity}
                    rangeKey={rangeKey}
                    onGranularityChange={setGranularity}
                    onRangeChange={setRangeKey}
                  />
                  <div className={isChartFullscreen ? 'mt-3 min-h-0 flex-1' : 'mt-3'}>
                    <MainChart
                      records={records}
                      granularity={granularity}
                      rangeKey={rangeKey}
                      reducedMotion={reduced}
                      isFullscreen={isChartFullscreen}
                      onToggleFullscreen={toggleChartFullscreen}
                    />
                  </div>
                </section>
              </motion.div>
            </motion.div>
          )}
        </main>

        {data && <Footer meta={data.meta} onOpenModal={() => setModalOpen(true)} />}

        {!modalOpen && !isChartFullscreen && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label="指标说明与风险提示"
            className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-pop transition-transform hover:scale-105"
          >
            <Info size={20} />
          </button>
        )}

        <ExplanationModal open={modalOpen} onClose={() => setModalOpen(false)} />

        <AnimatePresence>{toast && <Toast key={toast.id} data={toast} />}</AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}
