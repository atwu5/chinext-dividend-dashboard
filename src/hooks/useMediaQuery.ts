import { useEffect, useState } from 'react'

/** 响应式断点 / 指针类型等媒体查询 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    // 旧版 Safari（<14）仅支持 addListener/removeListener，缺失时降级
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    const legacy = mq as MediaQueryList & {
      addListener?: (cb: () => void) => void
      removeListener?: (cb: () => void) => void
    }
    legacy.addListener?.(onChange)
    return () => legacy.removeListener?.(onChange)
  }, [query])

  return matches
}
