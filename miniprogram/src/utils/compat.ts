/**
 * 兼容性补丁（必须在应用其余代码之前导入，app.ts 首行 import）：
 * echarts 内部存在 String.prototype.replaceAll 调用（ES2021 API），
 * 老旧运行时未实现时会在运行时抛错，这里提供一个最小 polyfill 兜底。
 */

const proto = String.prototype as unknown as {
  replaceAll?: (search: string | RegExp, replace: string | ((...args: unknown[]) => string)) => string
}

if (typeof proto.replaceAll !== 'function') {
  proto.replaceAll = function replaceAll(
    this: string,
    search: string | RegExp,
    replace: string | ((...args: unknown[]) => string),
  ): string {
    if (search instanceof RegExp) {
      if (!search.global) {
        throw new TypeError('String.prototype.replaceAll called with a non-global RegExp argument')
      }
      return this.replace(search, replace as string)
    }
    return this.split(search).join(replace as string)
  }
}
