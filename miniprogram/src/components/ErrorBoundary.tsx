import { Component, type ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import './ErrorBoundary.scss'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 页面级错误边界：子树渲染/生命周期抛异常时显示可读报错，替代整页白屏。
 * 小程序运行时没有 window.onerror 可看，白屏时这里是唯一的错误出口。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <View className='eb-root'>
          <Text className='eb-title'>页面渲染出错</Text>
          <Text className='eb-msg'>{this.state.error.message}</Text>
          <Text className='eb-hint'>请把上面这段报错截图发给开发者</Text>
        </View>
      )
    }
    return this.props.children
  }
}
