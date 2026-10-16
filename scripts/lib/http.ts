/** 带重试与超时的 GET JSON（数据脚本专用） */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export async function getJson<T = unknown>(url: string, referer: string, timeoutMs = 30000): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Referer: referer,
          Accept: 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`)
      return (await res.json()) as T
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
