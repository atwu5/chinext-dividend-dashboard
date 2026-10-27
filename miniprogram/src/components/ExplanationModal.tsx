/**
 * 指标说明与风险提示弹窗（手机底部抽屉形态，与 Web 端移动端一致）。
 * 文案来自 shared/explanation.ts，与 Web 端共用同一份，改一处两端同步。
 */
import { ScrollView, Text, View } from '@tarojs/components'
import { EXPLANATION_SECTIONS } from '../../../shared/explanation'
import './ExplanationModal.scss'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ExplanationModal({ open, onClose }: Props) {
  if (!open) return null
  return (
    <View className='em-mask' onClick={onClose}>
      <View
        className='em-sheet'
        onClick={(e) => e.stopPropagation()}
      >
        <View className='em-head'>
          <Text className='em-title'>指标说明与风险提示</Text>
          <Text className='em-close' onClick={onClose}>×</Text>
        </View>
        <ScrollView scrollY className='em-body' showScrollbar={false}>
          {EXPLANATION_SECTIONS.map((section) => (
            <View key={section.title} className='em-section'>
              <Text className='em-section-title'>{section.title}</Text>
              {section.paragraphs.map((p) => (
                <Text key={p.text} className={`em-p ${p.strong ? 'em-p-strong' : ''}`}>{p.text}</Text>
              ))}
              {section.bullets && section.bullets.map((b) => (
                <Text key={b} className='em-li'>· {b}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}
