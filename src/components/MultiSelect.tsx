'use client'

import { useEffect, useRef, useState } from 'react'

type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}

export default function MultiSelect({ options, value, onChange, placeholder = 'Alle' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? (options.find((o) => o.value === value[0])?.label ?? value[0])
      : `${value.length} valgt`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[160px] items-center justify-between gap-2 rounded-lg border border-[#3d3020] bg-[#1a1410] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A96E]"
      >
        <span className={value.length === 0 ? 'text-[#a89070]' : 'text-white truncate max-w-[140px]'}>{label}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-[#a89070] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-[#3d3020] bg-[#1a1410] shadow-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#a89070]">Ingen muligheder</div>
          ) : (
            <>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full px-3 py-2 text-left text-xs text-[#C8A96E] hover:bg-[#3d3020] border-b border-[#3d3020]"
                >
                  Ryd valg
                </button>
              )}
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[#3d3020]"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="accent-[#C8A96E]"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
