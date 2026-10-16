/**
 * 定期全量完整性检查（独立于日常增量更新，建议每周运行一次）：
 * 重新拉取全历史并与本地逐日比对，用于发现早期缺口与数据源历史修订。
 * - 无差异：不写任何文件
 * - 差异行占比 ≤ 10%：自动修复（补缺口 / 吸收修订），version + 1
 * - 差异行占比 > 10%：视为数据源口径变化，中止并保留旧数据
 * 日常访问与日常更新不做全量下载。
 */
import { TIMELINE_START } from '../shared/indices'
import type { DailyRecord, Metadata } from '../shared/types'
import { maxAcceptDate } from './lib/dates'
import { atomicWriteJson, HISTORICAL_FILE, METADATA_FILE, readJson } from './lib/fsutil'
import { fetchBothIndices } from './lib/providers'
import { roundRatio } from './lib/records'

const MAX_REPAIR_RATIO = 0.1
const CLOSE_EPS = 1e-6

async function main(): Promise<void> {
  const meta = readJson<Metadata>(METADATA_FILE)
  const records = readJson<DailyRecord[]>(HISTORICAL_FILE)
  console.log(
    `[integrity] 本地 ${records.length} 条（${records[0].date} ~ ${records[records.length - 1].date}），开始全量核对 …`,
  )

  const end = maxAcceptDate()
  const closes = await fetchBothIndices({ beg: TIMELINE_START, end })
  console.log(`[integrity] 数据源：${closes.provider.label}`)

  const next = new Map<string, DailyRecord>(records.map((r) => [r.date, r]))
  const allDates = new Set<string>([...next.keys(), ...closes.chinext.keys(), ...closes.dividend.keys()])

  let added = 0
  let revised = 0
  const samples: string[] = []
  const noteSample = (line: string) => {
    if (samples.length < 20) samples.push(line)
  }

  for (const date of allDates) {
    const c = closes.chinext.get(date)
    const d = closes.dividend.get(date)
    if (c === undefined || d === undefined) continue
    const existing = next.get(date)
    if (!existing) {
      next.set(date, { date, chinextClose: c, dividendClose: d, ratio: roundRatio(c, d) })
      added += 1
      noteSample(`+ ${date} 创业板指 ${c} / 中证红利 ${d}`)
      continue
    }
    if (
      Math.abs(existing.chinextClose - c) > CLOSE_EPS ||
      Math.abs(existing.dividendClose - d) > CLOSE_EPS
    ) {
      const oldC = existing.chinextClose
      const oldD = existing.dividendClose
      existing.chinextClose = c
      existing.dividendClose = d
      existing.ratio = roundRatio(c, d)
      revised += 1
      noteSample(`~ ${date} ${oldC}/${oldD} → ${c}/${d}`)
    }
  }

  const changed = added + revised
  if (changed === 0) {
    console.log('[integrity] 与数据源全量一致，无需修复')
    return
  }

  const changeRatio = changed / records.length
  if (changeRatio > MAX_REPAIR_RATIO) {
    throw new Error(
      `[integrity] 差异行 ${changed}/${records.length}（${(changeRatio * 100).toFixed(1)}%）超过 ` +
        `${MAX_REPAIR_RATIO * 100}% 阈值，疑似数据源口径变化，已中止且未写入任何文件`,
    )
  }

  const merged = [...next.values()].sort((a, b) => a.date.localeCompare(b.date))
  const nextMeta: Metadata = {
    ...meta,
    firstDate: merged[0].date,
    lastDate: merged[merged.length - 1].date,
    count: merged.length,
    version: meta.version + 1,
    lastUpdated: new Date().toISOString(),
    lastUpdateSource: closes.provider.id,
  }
  atomicWriteJson(HISTORICAL_FILE, merged)
  atomicWriteJson(METADATA_FILE, nextMeta)
  console.log(
    `[integrity] 修复完成：新增 ${added} 条，修订 ${revised} 条，现共 ${merged.length} 条，版本 v${nextMeta.version}`,
  )
  for (const line of samples) console.log(`[integrity] ${line}`)
}

main().catch((error: unknown) => {
  console.error('[integrity] 失败：', error instanceof Error ? error.message : error)
  console.error('[integrity] 本地历史数据未被修改')
  process.exit(1)
})
