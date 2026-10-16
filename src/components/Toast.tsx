import { motion } from 'framer-motion'

export interface ToastData {
  id: number
  message: string
  tone: 'success' | 'neutral' | 'error'
}

/** 数据更新提示（轻量展示，自动消失） */
export default function Toast({ data }: { data: ToastData }) {
  const toneClass =
    data.tone === 'error' ? 'bg-zone-high' : data.tone === 'success' ? 'bg-[#1E9E72]' : 'bg-ink'
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`fixed right-3 top-3 z-50 max-w-[calc(100vw-24px)] rounded-lg px-3.5 py-2.5 text-xs font-medium text-white shadow-pop ${toneClass}`}
    >
      {data.message}
    </motion.div>
  )
}
