import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = path.resolve(process.cwd(), 'public/data')
export const HISTORICAL_FILE = path.join(DATA_DIR, 'historical.json')
export const METADATA_FILE = path.join(DATA_DIR, 'metadata.json')

export function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function readJson<T>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch (error) {
    throw new Error(`读取 ${path.relative(process.cwd(), file)} 失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 临时文件写入 → 校验可解析 → 原子替换。
 * 避免更新中断（进程被杀 / 断电）造成 JSON 文件损坏。
 */
export function atomicWriteJson(file: string, data: unknown): void {
  const tmp = `${file}.tmp`
  const json = `${JSON.stringify(data, null, 2)}\n`
  fs.writeFileSync(tmp, json, 'utf8')
  JSON.parse(fs.readFileSync(tmp, 'utf8'))
  fs.renameSync(tmp, file)
}
