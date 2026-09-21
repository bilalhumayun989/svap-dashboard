export default function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-orange-500/10 border-orange-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${accent ? 'text-orange-400' : 'text-zinc-500'}`}>{label}</p>
      <p className={`text-3xl font-black mt-1 ${accent ? 'text-orange-400' : 'text-zinc-100'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}
