import './utils/compat'
import { PropsWithChildren } from 'react'
import { useError, useLaunch } from '@tarojs/taro'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('App launched.')
  })

  // 全局错误日志：任何未捕获异常都会进 Console，便于白屏类问题定位
  useError((err) => {
    console.error('[App onError]', err)
  })

  // children 是将要渲染的页面
  return children
}

export default App
