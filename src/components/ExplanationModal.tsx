import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { EXPLANATION_SECTIONS } from '../../shared/explanation'

interface Props {
  open: boolean
  onClose: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-1.5 space-y-1.5 text-[13px] leading-6 text-[#4A5872]">{children}</div>
    </section>
  )
}

/**
 * 指标说明与风险提示模态弹窗：
 * PC 居中弹窗，手机底部抽屉（近全屏）；支持关闭按钮、右上角 X、ESC、遮罩点击，内部可滚动。
 */
export default function ExplanationModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="指标说明与风险提示"
            initial={{ opacity: 0, y: 48, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-pop sm:max-w-2xl sm:rounded-2xl sm:p-7"
          >
            <div className="sticky -mx-5 top-0 mb-3 flex items-center justify-between border-b border-line bg-white px-5 pb-3 pt-1 sm:-mx-7 sm:px-7">
              <h2 className="text-base font-semibold">指标说明与风险提示</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[#F1F3F8] hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

{EXPLANATION_SECTIONS.map((section) => (
              <Section key={section.title} title={section.title}>
                {section.paragraphs.map((p) => (
                  <p key={p.text} className={p.strong ? 'font-medium text-ink' : undefined}>
                    {p.text}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </Section>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
