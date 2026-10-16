/** 首屏加载骨架屏 */
export default function Skeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-card md:h-32" />
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="h-4 w-44 rounded bg-[#EDF0F5]" />
        <div className="mt-4 h-[400px] rounded-xl bg-[#EDF0F5] md:h-[560px]" />
      </div>
    </div>
  )
}
