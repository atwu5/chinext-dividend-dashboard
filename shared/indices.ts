/**
 * 两个指数的业务口径常量：前端展示与数据脚本共用，保证单一事实来源。
 */

export const INDEX_META = {
  chinext: {
    key: 'chinext',
    code: '399006',
    market: 'SZ',
    fullCode: '399006.SZ',
    name: '创业板指',
    displayName: '创业板指数',
    /**
     * 东方财富 push2his 的 secid：市场前缀 0 = 深市、1 = 沪市。
     * 注意：0.000922 是深市个股「佳电股份」，1.000922 才是沪市指数「中证红利」，
     * 因此脚本侧对返回的 code 与 name 做双重断言，防止拿错标的。
     */
    eastmoneySecid: '0.399006',
    /** 腾讯财经代码：sz / sh 前缀 + 6 位代码 */
    tencentSymbol: 'sz399006',
  },
  dividend: {
    key: 'dividend',
    code: '000922',
    market: 'SH',
    fullCode: '000922.SH',
    name: '中证红利',
    displayName: '中证红利指数',
    eastmoneySecid: '1.000922',
    tencentSymbol: 'sh000922',
  },
} as const

export type IndexKey = keyof typeof INDEX_META

export const INDEX_KEYS: IndexKey[] = ['chinext', 'dividend']

/**
 * 页面时间轴起点：创业板市场开市日。
 * 注意这不等于创业板指数（399006）的数据起始日——该指数基日为 2010-05-31，
 * 指数发布前的日期在图表上保留空白，不编造数据。
 */
export const TIMELINE_START = '2009-10-30'

/** 用户指定的历史参考线（研究参考阈值，非统计检验结论） */
export const REF_LOW = 0.3
export const REF_HIGH = 0.7

/** 比值存储精度（界面展示 3 位小数，后续计算使用存储的 6 位精度值） */
export const RATIO_DECIMALS = 6
