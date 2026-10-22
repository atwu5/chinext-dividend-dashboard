/**
 * 与 Web 同源的数据地址。
 * 小程序不直连行情接口，只消费 Web 数据管线（GitHub Actions 每日更新）产出的静态 JSON，
 * 保证两端口径、版本完全一致。
 * 真机请求前需在 mp.weixin.qq.com 后台把该域名加入 request 合法域名（详见 miniprogram/README.md）。
 */
export const DATA_BASE_URL = 'https://atwu5.github.io/chinext-dividend-dashboard'
