import { REF_HIGH, REF_LOW } from './indices'

export interface ExplanationParagraph {
  text: string
  /** 强调段落（前端加粗展示） */
  strong?: boolean
}

export interface ExplanationSection {
  title: string
  paragraphs: ExplanationParagraph[]
  bullets?: string[]
}

/**
 * 「指标说明与风险提示」弹窗文案：Web 与小程序共用同一份，改这里两端自动同步。
 */
export const EXPLANATION_SECTIONS: ExplanationSection[] = [
  {
    title: '指标计算规则',
    paragraphs: [
      { text: '本工具通过创业板指数与中证红利指数相同交易日的收盘点位计算相对比值。' },
      { text: '计算公式：相对比值 = 创业板指数收盘点位 ÷ 中证红利指数收盘点位（保留 6 位小数，界面展示 3 位）。' },
      { text: '比值反映指数之间的相对价格位置变化，不等于两者的真实估值比例。' },
    ],
  },
  {
    title: '历史参考线',
    paragraphs: [
      { text: `${REF_LOW.toFixed(3)} 与 ${REF_HIGH.toFixed(3)} 来源于历史行情观察，用于辅助识别相对位置。` },
      { text: '这两个阈值不保证长期有效，也不代表市场一定在附近见底或见顶。' },
    ],
  },
  {
    title: '指标使用限制',
    paragraphs: [],
    bullets: [
      '指数比值不等于估值比值。',
      '历史上涨或下跌不保证未来重复。',
      '市场结构变化可能导致历史区间失效。',
      '两种资产可能同时上涨或同时下跌。',
      '价格指数未完整反映分红再投资回报。',
      '历史极值不代表确定的买卖点。',
    ],
  },
  {
    title: '风险提示',
    paragraphs: [
      { text: '本工具仅供个人研究、历史数据观察及市场风格分析使用，不构成证券、基金投资建议，也不承诺任何投资收益。' },
      { text: '投资有风险，决策需谨慎。', strong: true },
    ],
  },
]
