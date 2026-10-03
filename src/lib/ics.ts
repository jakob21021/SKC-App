import type { ClubEvent, Venue } from '@/data/types'
import { club } from '@/config/club'

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Lange Zeilen nach RFC 5545 auf 75 Zeichen umbrechen */
const fold = (line: string) => line.replace(/(.{74})/g, '$1\r\n ').trimEnd()

export function buildIcs(events: ClubEvent[], venues: Venue[], calName: string = club.name) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${club.short}//Vereins-App//DE`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escape(calName)}`,
  ]
  for (const e of events) {
    const venue = venues.find((v) => v.id === e.venueId)
    const location = venue ? [venue.name, venue.street, venue.city].filter(Boolean).join(', ') : ''
    const desc = [
      e.meetAt ? `Treffpunkt: ${new Date(e.meetAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` : '',
      e.description ?? '',
    ]
      .filter(Boolean)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@${club.short.toLowerCase()}-app`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      fold(`SUMMARY:${escape((e.cancelled ? 'ABGESAGT: ' : '') + e.title)}`),
    )
    if (location) lines.push(fold(`LOCATION:${escape(location)}`))
    if (desc) lines.push(fold(`DESCRIPTION:${escape(desc)}`))
    if (e.cancelled) lines.push('STATUS:CANCELLED')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
