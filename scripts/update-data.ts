/**
 * 增量更新（每个交易日收盘后由 GitHub Actions 调用，也可手动执行）：
 * 1. 读取本地 metadata / historical，确定本地最新有效交易日
 * 2. 只拉取「本地最新日期前 10 个日历日 ~ 最大可接受交易日」的区间
 *    （既覆盖新增交易日，也重查最近 5+ 个交易日以吸收数据源历史修正）
 * 3. 合并新增与修正，重算受影响日期的比值；按日期去重升序，同日多次运行不产生重复记录
 * 4. 新数据异常（收盘价无效或单日波动 > 15%）时中止并保留旧版本，不写任何文件
 * 5. 校验通过后原子写入，version + 1；无变化则不动文件、不触发部署
 */
import type { DailyRecord, Metadata } from '../shared/types'
import { maxAcceptDate, shiftDays } from './lib/dates'
import { atomicWriteJson, HISTORICAL_FILE, METADATA_FILE, readJson } from './lib/fsutil'
import { fetchBothIndices } from './lib/providers'
import { roundRatio } from './lib/records'

const CORRECTION_WINDOW_DAYS = 10
const DAILY_MOVE_LIMIT = 0.15

async function main(): Promise<void> {
  const meta = readJson<Metadata>(METADATA_FILE)
  const records = readJson<DailyRecord[]>(HISTORICAL_FILE)
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('本地历史数据为空或损坏，请先执行 npm run data:init')
  }
  const localLast = records[records.length - 1].date
  const end = maxAcceptDate()
  if (end <= localLast) {
    console.log(`[update] 无新的交易日可写入（本地最新 ${localLast}，当前可接受至 ${end}），数据保持不变`)
    return
  }

  const beg = shiftDays(localLast, -CORRECTION_WINDOW_DAYS)
  console.log(`[update] 本地最新 ${localLast}；拉取 ${beg} ~ ${end}（含近期修正窗口）`)
  const closes = await fetchBothIndices({ beg, end })
  console.log(`[update] 数据源：${closes.provider.label}`)

  // 与本地记录共享同一组对象，修正与追加都作用在 next 上
  const next = new Map<string, DailyRecord>(records.map((r) => [r.date, r]))
  let appended = 0
  let corrected = 0

  // 1) 修正窗口内的既有日期：以数据源最新返回值覆盖（处理历史修订）
  for (const date of new Set([...closes.chinext.keys(), ...closes.dividend.keys()])) {
    const existing = next.get(date)
    if (!existing) continue
    const c = closes.chinext.get(date)
    const d = closes.dividend.get(date)
    if (c === undefined || d === undefined) continue
    if (existing.chinextClose !== c || existing.dividendClose !== d) {
      existing.chinextClose = c
      existing.dividendClose = d
      existing.ratio = roundRatio(c, d)
      corrected += 1
    }
  }

  // 2) 追加本地没有的日期（两个指数同日都有收盘才有效），并做异常波动检查
  const allDates = [...new Set([...closes.chinext.keys(), ...closes.dividend.keys()])].sort()
  let prev = records[records.length - 1]
  for (const date of allDates) {
    if (date <= localLast) continue
    const c = closes.chinext.get(date)
    const d = closes.dividend.get(date)
    if (c === undefined || d === undefined) continue
    const checks: Array<[number, string, number]> = [
      [c, '创业板指', prev.chinextClose],
      [d, '中证红利', prev.dividendClose],
    ]
    for (const [value, label, prevClose] of checks) {
      if (prevClose > 0 && Math.abs(value / prevClose - 1) > DAILY_MOVE_LIMIT) {
        throw new Error(
          `[update] 新数据异常：${date} ${label} 收盘 ${value} 相对上一交易日 ${prevClose} 波动超过 15%，` +
            '疑似数据源异常。已保留旧版本，未写入任何文件。',
        )
      }
    }
    if (next.has(date)) continue
    const rec: DailyRecord = { date, chinextClose: c, dividendClose: d, ratio: roundRatio(c, d) }
    next.set(date, rec)
    prev = rec
    appended += 1
  }

  if (appended === 0 && corrected === 0) {
    console.log('[update] 数据源未提供新交易日，也无历史修正，数据保持不变（不触发部署）')
    return
  }

  const merged = [...next.values()].sort((a, b) => a.date.localeCompare(b.date))
  const lastDate = merged[merged.length - 1].date
  const nextMeta: Metadata = {
    ...meta,
    firstDate: merged[0].date,
    lastDate,
    count: merged.length,
    version: meta.version + 1,
    lastUpdated: new Date().toISOString(),
    lastUpdateSource: closes.provider.id,
  }

  atomicWriteJson(HISTORICAL_FILE, merged)
  atomicWriteJson(METADATA_FILE, nextMeta)
  console.log(
    `[update] 完成：新增 ${appended} 条，修正 ${corrected} 条，现共 ${merged.length} 条` +
      `（${merged[0].date} ~ ${lastDate}），版本 v${nextMeta.version}`,
  )
}

main().catch((error: unknown) => {
  console.error('[update] 失败：', error instanceof Error ? error.message : error)
  console.error('[update] 本地历史数据未被修改，线上数据保持上一有效版本')
  process.exit(1)
})
