import {
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns'
import { de } from 'date-fns/locale'

const d = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v)

export const fmt = (v: string | Date, pattern: string) => format(d(v), pattern, { locale: de })

export const fmtTime = (v: string | Date) => fmt(v, 'HH:mm')

/** "Heute", "Morgen", "Gestern" oder "Di., 6. Okt." */
export function fmtDayLabel(v: string | Date, withYear = false) {
  const date = d(v)
  if (isToday(date)) return 'Heute'
  if (isTomorrow(date)) return 'Morgen'
  if (isYesterday(date)) return 'Gestern'
  return fmt(date, withYear ? 'EEEEEE., d. MMM yyyy' : 'EEEEEE., d. MMM')
}

export function fmtDayLong(v: string | Date) {
  const date = d(v)
  const prefix = isToday(date) ? 'Heute, ' : isTomorrow(date) ? 'Morgen, ' : ''
  return prefix + fmt(date, 'EEEE, d. MMMM yyyy')
}

export function fmtRange(start: string, end: string) {
  const s = d(start)
  const e = d(end)
  if (isSameDay(s, e)) return `${fmtTime(s)} – ${fmtTime(e)} Uhr`
  return `${fmt(s, 'd. MMM HH:mm')} – ${fmt(e, 'd. MMM HH:mm')}`
}

export function fmtRelative(v: string | Date) {
  const date = d(v)
  const mins = differenceInMinutes(new Date(), date)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  if (mins < 60 * 24 && isToday(date)) return `vor ${Math.floor(mins / 60)} Std.`
  if (isYesterday(date)) return `gestern, ${fmtTime(date)}`
  const days = differenceInCalendarDays(new Date(), date)
  if (days < 7) return fmt(date, 'EEEE, HH:mm')
  return fmt(date, 'd. MMM yyyy')
}

/** "noch 2 Tage", "noch 5 Std." – für Rückmeldefristen */
export function fmtCountdown(v: string | Date) {
  const date = d(v)
  if (date.getTime() < Date.now()) return 'abgelaufen'
  return 'noch ' + formatDistanceToNowStrict(date, { locale: de })
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Hallo'
  return 'Guten Abend'
}

export const dayKey = (v: string | Date) => format(d(v), 'yyyy-MM-dd')
