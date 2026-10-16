/**
 * 数据校验：schema、排序唯一性、比值一致性、metadata 一致性、时间轴起点，
 * 以及单日波动 / 日历间隔扫描（提示性输出，供人工复核）。
 * 全部硬校验通过退出码 0，否则 1。
 */
import { RATIO_DECIMALS, TIMELINE_START } from '../shared/indices'
import type { DailyRecord, Metadata } from '../shared/types'
import { HISTORICAL_FILE, METADATA_FILE, readJson } from './lib/fsutil'

let failed = false

function check(ok: boolean, message: string): void {
  console.log(`${ok ? '✓' : '✗'} ${message}`)
  if (!ok) failed = true
}

function warn(message: string): void {
  console.log(`! ${message}`)
}

async function main(): Promise<void> {
  const meta = readJson<Metadata>(METADATA_FILE)
  const records = readJson<DailyRecord[]>(HISTORICAL_FILE)

  check(Array.isArray(records) && records.length > 0, `historical.json 为非空数组（${records.length} 条）`)

  const factor = 10 ** RATIO_DECIMALS
  let badClose = 0
  let badRatio = 0
  for (const r of records) {
    if (
      !Number.isFinite(r.chinextClose) ||
      !Number.isFinite(r.dividendClose) ||
      r.chinextClose <= 0 ||
      r.dividendClose <= 0
    ) {
      badClose += 1
      continue
    }
    const expected = Math.round((r.chinextClose / r.dividendClose) * factor) / factor
    if (Math.abs(expected - r.ratio) > 1e-9) badRatio += 1
  }
  check(badClose === 0, `收盘价均为正数且有效（异常 ${badClose} 条）`)
  check(badRatio === 0, `ratio 与「收盘价 ÷ 收盘价」逐条重算一致（异常 ${badRatio} 条）`)

  let orderOk = true
  for (let i = 1; i < records.length; i += 1) {
    if (records[i].date <= records[i - 1].date) {
      orderOk = false
      break
    }
  }
  check(orderOk, '日期严格升序且无重复')

  check(meta.count === records.length, `metadata.count（${meta.count}）与实际条数一致`)
  check(meta.firstDate === records[0]?.date, `metadata.firstDate（${meta.firstDate}）与首条记录一致`)
  check(meta.lastDate === records[records.length - 1]?.date, `metadata.lastDate（${meta.lastDate}）与末条记录一致`)
  check(meta.timelineStart === TIMELINE_START, `时间轴起点 = ${TIMELINE_START}（创业板市场开市日）`)
  check(Number.isFinite(meta.version) && meta.version >= 1, `数据版本有效（v${meta.version}）`)
  check(Boolean(meta.source) && Boolean(meta.sourceName), `数据来源已记录（${meta.sourceName}）`)

  // —— 以下为提示性扫描，不影响退出码 ——
  const minRec = records.reduce((a, b) => (b.ratio < a.ratio ? b : a))
  const maxRec = records.reduce((a, b) => (b.ratio > a.ratio ? b : a))
  warn(`比值极值：最低 ${minRec.ratio}（${minRec.date}），最高 ${maxRec.ratio}（${maxRec.date}）`)

  for (const key of ['chinextClose', 'dividendClose'] as const) {
    for (let i = 1; i < records.length; i += 1) {
      const prev = records[i - 1][key]
      const cur = records[i][key]
      if (prev > 0 && Math.abs(cur / prev - 1) > 0.15) {
        warn(`单日波动超过 15%：${records[i].date} ${key} ${prev} → ${cur}，请人工核对`)
      }
    }
  }

  let maxGap = 0
  let maxGapAt = ''
  for (let i = 1; i < records.length; i += 1) {
    const days = Math.round((Date.parse(records[i].date) - Date.parse(records[i - 1].date)) / 86400000)
    if (days > maxGap) {
      maxGap = days
      maxGapAt = `${records[i - 1].date} → ${records[i].date}`
    }
  }
  warn(`最大日历间隔 ${maxGap} 天（${maxGapAt}）；春节/国庆长假约 8~12 天属正常，超过 16 天建议人工检查`)

  if (failed) {
    console.error('[validate] 存在未通过的校验项')
    process.exit(1)
  }
  console.log('[validate] 全部通过')
}

main().catch((error: unknown) => {
  console.error('[validate] 执行失败：', error instanceof Error ? error.message : error)
  process.exit(1)
})
