import { useEffect, useRef, useState } from 'react'

/** 数字滚动动效；开启「减少动态效果」或数值无效时直接展示最终值 */
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
    const start = performance.now()
    const duration = 700
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - p) ** 3
      setValue(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled])

  return value
}
