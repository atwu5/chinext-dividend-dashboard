import './utils/compat'
import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('App launched.')
  })

  // children 是将要渲染的页面
  return children
}

export default App
