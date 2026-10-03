import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'skc-theme'

function readPref(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'system'
  } catch {
    return 'system'
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#09090b' : '#d41f26')
}

export function initTheme() {
  apply(readPref())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(readPref()))
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* egal */
    }
    apply(pref)
  }, [pref])
  return [pref, setPref] as const
}
