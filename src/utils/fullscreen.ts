/**
 * 浏览器全屏工具：标准 Fullscreen API + Safari webkit 前缀兜底。
 * iPhone Safari 不支持任意元素全屏（仅视频），调用方需捕获错误并提示。
 */

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

export function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function isFullscreenSupported(target: HTMLElement): boolean {
  return (
    typeof target.requestFullscreen === 'function' ||
    typeof (target as FullscreenTarget).webkitRequestFullscreen === 'function'
  )
}

export async function enterFullscreen(target: HTMLElement): Promise<void> {
  const el = target as FullscreenTarget
  if (typeof el.requestFullscreen === 'function') {
    await el.requestFullscreen()
    return
  }
  if (typeof el.webkitRequestFullscreen === 'function') {
    await el.webkitRequestFullscreen()
    return
  }
  throw new Error('当前浏览器不支持全屏模式')
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument
  if (getFullscreenElement() === null) return
  if (typeof doc.exitFullscreen === 'function') {
    await doc.exitFullscreen()
    return
  }
  if (typeof doc.webkitExitFullscreen === 'function') {
    await doc.webkitExitFullscreen()
    return
  }
}
