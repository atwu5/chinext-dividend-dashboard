import { useEffect, useRef, useState } from 'react'

/**
 * 数字滚动动效；API 与 Web 端 src/hooks/useCountUp.ts 一致。
 * 小程序运行时没有 requestAnimationFrame / performance.now，用 setInterval 步进适配。
 */
export function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(() => (enabled ? 0 : target))
  const prevRef = useRef(enabled ? 0 : target)

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      prevRef.current = target
      setValue(target)
      return
    }
    const from = prevRef.current
    prevRef.current = target
    if (from === target) {
      setValue(target)
      return
    }
    const start = Date.now()
    const duration = 700
    const timer = setInterval(() => {
      const now = Date.now()
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - p) ** 3
      setValue(from + (target - from) * eased)
      if (p >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target, enabled])

  return value
}
