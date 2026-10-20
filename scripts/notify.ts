/**
 * 数据入库后的微信推送（虾推啥 .send 通道）：
 * - 通道地址从环境变量 XTUIS_PUSH_URLS 读取（逗号分隔；存于仓库 Secrets，避免公开仓库泄露）
 * - text = 创业板指数/中证红利=比值；desp = 交易日日期；url = 仪表盘跳转地址（固定）
 * - 推送失败仅记录日志、进程以 0 退出：通知失败绝不能阻断数据发布/部署链路
 */
import type { DailyRecord, Metadata } from '../shared/types'
import { HISTORICAL_FILE, METADATA_FILE, readJson } from './lib/fsutil'

const DASHBOARD_URL = 'https://atwu5.github.io/chinext-dividend-dashboard/'

function maskUrl(url: string): string {
  return url.replace(/(https:\/\/wx\.xtuis\.cn\/.{4}).*(\.send)/, '$1****$2')
}

async function notifyOne(url: string, text: string, desp: string): Promise<boolean> {
  const target =
    `${url}${url.includes('?') ? '&' : '?'}` +
    `text=${encodeURIComponent(text)}&desp=${encodeURIComponent(desp)}&url=${encodeURIComponent(DASHBOARD_URL)}`
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        console.log(`  ✓ 通道推送成功（HTTP ${res.status}）：${maskUrl(url)}`)
        return true
      }
      console.log(`  ✗ 第 ${attempt} 次推送 HTTP ${res.status}：${maskUrl(url)}`)
    } catch (error) {
      console.log(`  ✗ 第 ${attempt} 次推送异常：${error instanceof Error ? error.message : String(error)}（${maskUrl(url)}）`)
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return false
}

async function main(): Promise<void> {
  const urls = (process.env.XTUIS_PUSH_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (urls.length === 0) {
    console.log('[notify] 未配置 XTUIS_PUSH_URLS（仓库 Secrets），跳过微信推送')
    return
  }

  const meta = readJson<Metadata>(METADATA_FILE)
  const records = readJson<DailyRecord[]>(HISTORICAL_FILE)
  const last = records[records.length - 1]
  if (last.date !== meta.lastDate) {
    console.log(`[notify] 数据不一致（末条 ${last.date} ≠ metadata ${meta.lastDate}），跳过推送`)
    return
  }

  // 入参规则（用户指定）：text = 创业板指数/中证红利=比值；desp = 交易日日期；url = 仪表盘跳转地址
  const text = `创业板指数/中证红利=${last.ratio}`
  const desp = last.date
  console.log(`[notify] 推送 ${urls.length} 个通道：text="${text}" desp="${desp}"`)

  let success = 0
  for (const url of urls) {
    if (await notifyOne(url, text, desp)) success += 1
  }
  console.log(`[notify] 完成：${success}/${urls.length} 个通道推送成功`)
  if (success === 0) {
    console.log('[notify] ⚠️ 所有通道均失败——请检查通道地址是否有效（推送失败不影响数据发布）')
  }
}

main().catch((error: unknown) => {
  console.error('[notify] 执行异常（不影响数据发布）：', error instanceof Error ? error.message : error)
})
