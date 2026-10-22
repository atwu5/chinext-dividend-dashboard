import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cachedDashboardData,
  loadDashboardData,
  setCachedDashboardData,
  type DashboardData,
} from '../services/marketData/loader'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface RefreshResult {
  ok: boolean
  changed: boolean
  message: string
}

export interface UseMarketDataResult {
  status: LoadStatus
  data: DashboardData | null
  error: string | null
  refreshing: boolean
  reload: () => Promise<RefreshResult>
}

/**
 * 数据生命周期（与 Web 端同名 hook 行为一致）：
 * - 首次进入显示加载态，加载失败进入错误态（带重试），绝不静默展示错误数据
 * - 刷新按钮重新检查已部署的数据版本：版本未变提示「已是最新」，版本变化加载新数据
 * - 刷新失败时保留当前已加载数据并明确提示，不把旧数据伪装成最新
 */
export function useMarketData(): UseMarketDataResult {
  const [status, setStatus] = useState<LoadStatus>(() => (cachedDashboardData() ? 'ready' : 'loading'))
  const [data, setData] = useState<DashboardData | null>(cachedDashboardData())
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const initedRef = useRef(false)

  const load = useCallback(async (): Promise<DashboardData> => {
    const fresh = await loadDashboardData()
    setCachedDashboardData(fresh)
    setData(fresh)
    return fresh
  }, [])

  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    load()
      .then(() => setStatus('ready'))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  }, [load])

  const reload = useCallback(async (): Promise<RefreshResult> => {
    setRefreshing(true)
    try {
      const prev = cachedDashboardData()
      const fresh = await load()
      const changed = !prev || fresh.meta.version !== prev.meta.version
      setStatus('ready')
      setError(null)
      return {
        ok: true,
        changed,
        message: changed
          ? `已加载最新数据 v${fresh.meta.version}（截至 ${fresh.meta.lastDate}）`
          : '数据已是最新版本',
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, changed: false, message: `刷新失败：${message}（当前仍显示已加载数据）` }
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return { status, data, error, refreshing, reload }
}
