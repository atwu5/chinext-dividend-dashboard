/**
 * 首次初始化：
 * 1. 拉取两个指数自 2009-10-30（时间轴起点）以来的完整可用历史
 * 2. 按交易日期对齐（两个指数同日均有收盘才有效），计算相对比值
 * 3. 校验数据量与起始日期合理性后，生成 historical.json 与 metadata.json
 *
 * 幂等：重复执行会得到相同结果（version 重置为 1）。
 * 注意：创业板指数（399006）基日为 2010-05-31，因此实际数据从指数可核实的首个交易日开始，
 * 此前的时间轴区间保留空白，不编造数据。
 */
import path from 'node:path'
import { INDEX_META, TIMELINE_START, type IndexKey } from '../shared/indices'
import type { Metadata } from '../shared/types'
import { maxAcceptDate } from './lib/dates'
import { atomicWriteJson, ensureDataDir, HISTORICAL_FILE, METADATA_FILE } from './lib/fsutil'
import { fetchBothIndices } from './lib/providers'
import { buildRecords } from './lib/records'

const SCRIPT_VERSION = '1.0.0'

function topGaps(records: { date: string }[], limit = 5): Array<{ from: string; to: string; days: number }> {
  const gaps: Array<{ from: string; to: string; days: number }> = []
  for (let i = 1; i < records.length; i += 1) {
    const a = records[i - 1].date
    const b = records[i].date
    const days = Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
    if (days > 1) gaps.push({ from: a, to: b, days })
  }
  return gaps.sort((x, y) => y.days - x.days).slice(0, limit)
}

async function main(): Promise<void> {
  console.log('[init] 开始初始化历史数据 …')
  const end = maxAcceptDate()
  console.log(`[init] 数据接受范围：${TIMELINE_START} ~ ${end}（仅收盘数据，盘中/未收盘日不入库）`)

  const closes = await fetchBothIndices({ beg: TIMELINE_START, end })
  console.log(`[init] 数据源：${closes.provider.label}`)
  console.log(`[init] 数据商返回：创业板指 ${closes.chinext.size} 条，中证红利 ${closes.dividend.size} 条`)

  const records = buildRecords(closes)
  if (records.length < 1000) {
    throw new Error(
      `[init] 有效记录仅 ${records.length} 条，明显低于预期（两个指数对齐后应有 3000+ 条），终止以免保存残缺数据`,
    )
  }
  const firstDate = records[0].date
  const lastDate = records[records.length - 1].date
  if (firstDate > '2012-01-01') {
    throw new Error(`[init] 首个有效日期 ${firstDate} 晚于 2012-01-01，疑似历史覆盖不完整，终止`)
  }

  const rangeOf = (key: IndexKey): { first: string; last: string } => {
    const dates = [...closes[key].keys()].sort()
    return { first: dates[0] ?? '', last: dates[dates.length - 1] ?? '' }
  }
  const providerSymbol = (key: IndexKey): string =>
    closes.provider.id === 'eastmoney' ? INDEX_META[key].eastmoneySecid : INDEX_META[key].tencentSymbol

  const metadata: Metadata = {
    timelineStart: TIMELINE_START,
    source: closes.provider.id,
    sourceName: closes.provider.label,
    caliber:
      'A股指数日K线收盘点位（不复权）；仅保留两个指数同日均有收盘数据的交易日；指数发布前无可靠历史，保留空白',
    indices: {
      chinext: {
        fullCode: INDEX_META.chinext.fullCode,
        providerSymbol: providerSymbol('chinext'),
        name: INDEX_META.chinext.name,
        firstDate: rangeOf('chinext').first,
        lastDate: rangeOf('chinext').last,
      },
      dividend: {
        fullCode: INDEX_META.dividend.fullCode,
        providerSymbol: providerSymbol('dividend'),
        name: INDEX_META.dividend.name,
        firstDate: rangeOf('dividend').first,
        lastDate: rangeOf('dividend').last,
      },
    },
    firstDate,
    lastDate,
    count: records.length,
    version: 1,
    lastUpdated: new Date().toISOString(),
    ratioDefinition: '相对比值 = 创业板指数收盘点位 ÷ 中证红利指数收盘点位（存储 6 位小数）',
    scriptVersion: SCRIPT_VERSION,
  }

  ensureDataDir()
  atomicWriteJson(HISTORICAL_FILE, records)
  atomicWriteJson(METADATA_FILE, metadata)

  const min = records.reduce((a, b) => (b.ratio < a.ratio ? b : a))
  const max = records.reduce((a, b) => (b.ratio > a.ratio ? b : a))
  console.log(`[init] 完成：${records.length} 条，${firstDate} ~ ${lastDate}，版本 v1`)
  console.log(`[init] 全历史最低比值 ${min.ratio}（${min.date}）；最高 ${max.ratio}（${max.date}）`)
  console.log('[init] 最大的几处日历间隔（春节/国庆长假 8~12 天属正常）：')
  for (const gap of topGaps(records)) {
    console.log(`[init]   ${gap.from} → ${gap.to}（${gap.days} 天）`)
  }
  console.log(
    `[init] 输出：${path.relative(process.cwd(), HISTORICAL_FILE)} / ${path.relative(process.cwd(), METADATA_FILE)}`,
  )
}

main().catch((error: unknown) => {
  console.error('[init] 失败：', error instanceof Error ? error.message : error)
  process.exit(1)
})
