/**
 * 与 Web 同源的数据源列表（按顺序自动回退）：
 * 1. GitHub Pages：与 Web 完全同源（主源）
 * 2. jsDelivr：GitHub 仓库内容的公共 CDN，大陆可达性通常好于 github.io；
 *    缓存最长滞后约半天，且不保证永远可达——它是过渡期的兜底，不是终态
 *
 * 真机请求前需在平台后台把两个域名都加入 request 合法域名：
 *   atwu5.github.io 与 cdn.jsdelivr.net
 * 终态方案：备案域名 + 腾讯云 COS/阿里云 OSS 静态托管（GitHub Actions 增加上传步骤），
 * 到时把新域名插入本列表第一位即可，两端继续同源。
 */
export const DATA_SOURCES = [
  'https://atwu5.github.io/chinext-dividend-dashboard',
  'https://cdn.jsdelivr.net/gh/atwu5/chinext-dividend-dashboard@main/public',
]
