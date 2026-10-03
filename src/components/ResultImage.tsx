// Erzeugt eine teilbare Ergebnis-Grafik (1080×1350, Instagram-Format) direkt im Browser.
import { useState } from 'react'
import { Download, ImageDown, Share2 } from 'lucide-react'
import { club } from '@/config/club'
import type { ClubEvent, GameAction, Member } from '@/data/types'
import { fmt } from '@/lib/dates'
import { resultOf } from '@/lib/korfball'
import { playerStats } from '@/lib/stats'
import { shortName } from '@/lib/util'
import { useClub, useGameActions } from '@/state/queries'
import { Button, Sheet } from './ui'
import { useToast } from './Toast'

const W = 1080
const H = 1350

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function renderResultImage(event: ClubEvent, actions: GameAction[], memberById: Map<string, Member>, teamName: string) {
  const g = event.game!
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  await Promise.all([
    document.fonts.load('italic 800 100px "Barlow Condensed"'),
    document.fonts.load('700 40px "Barlow Condensed"'),
    document.fonts.load('600 32px "Inter Variable"'),
  ]).catch(() => {})

  // Hintergrund: Vereinsrot mit Streifen
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#d41f26')
  bg.addColorStop(1, '#7b191d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalAlpha = 0.07
  ctx.fillStyle = '#fff'
  for (let x = -H; x < W + H; x += 110) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 45, 0)
    ctx.lineTo(x + 45 - H * 0.7, H)
    ctx.lineTo(x - H * 0.7, H)
    ctx.fill()
  }
  ctx.restore()

  try {
    const logo = await loadImage(`${import.meta.env.BASE_URL}logo.svg`)
    ctx.drawImage(logo, W / 2 - 110, 90, 220, 220)
  } catch {
    /* ohne Logo weiter */
  }

  const result = resultOf(g.scoreUs, g.scoreThem)
  const headline = result === 'win' ? 'SIEG!' : result === 'draw' ? 'REMIS' : 'ENDSTAND'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = 'italic 800 150px "Barlow Condensed", sans-serif'
  ctx.fillText(headline, W / 2, 470)

  ctx.font = '700 36px "Barlow Condensed", sans-serif'
  ctx.globalAlpha = 0.8
  ctx.fillText(`${teamName.toUpperCase()} · ${g.competition.toUpperCase()} · ${fmt(event.start, 'dd.MM.yyyy')}`, W / 2, 530)
  ctx.globalAlpha = 1

  // Ergebniskasten
  const left = g.home ? club.name : g.opponent
  const right = g.home ? g.opponent : club.name
  const ls = g.home ? g.scoreUs : g.scoreThem
  const rs = g.home ? g.scoreThem : g.scoreUs
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  roundRect(ctx, 70, 590, W - 140, 330, 40)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'italic 800 230px "Barlow Condensed", sans-serif'
  ctx.fillText(`${ls}:${rs}`, W / 2, 830)
  ctx.font = '700 40px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  wrapText(ctx, left.toUpperCase(), 110, 660, 300, 44)
  ctx.textAlign = 'right'
  wrapText(ctx, right.toUpperCase(), W - 110, 660, 300, 44)

  // Top-Torschützen
  const top = playerStats(actions.filter((a) => a.eventId === event.id)).slice(0, 4)
  ctx.textAlign = 'center'
  if (top.length) {
    ctx.font = '700 34px "Barlow Condensed", sans-serif'
    ctx.globalAlpha = 0.75
    ctx.fillText('KÖRBE', W / 2, 1010)
    ctx.globalAlpha = 1
    ctx.font = '600 38px "Inter Variable", sans-serif'
    const line = top
      .map((s) => {
        const m = memberById.get(s.memberId)
        return m ? `${shortName(m)} ${s.goals}` : null
      })
      .filter(Boolean)
      .join('  ·  ')
    wrapText(ctx, line, W / 2, 1070, W - 160, 52)
  }

  ctx.font = 'italic 800 54px "Barlow Condensed", sans-serif'
  ctx.fillText(`#${club.short}  #KORFBALL`, W / 2, H - 80)
  return canvas
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = w
      y += lineHeight
    } else line = test
  }
  ctx.fillText(line, x, y)
}

export function ResultImageButton({ event }: { event: ClubEvent }) {
  const { memberById, teamById } = useClub()
  const actions = useGameActions([event.id])
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const file = `skc-${fmt(event.start, 'yyyy-MM-dd')}.png`

  const create = async () => {
    setBusy(true)
    const canvas = await renderResultImage(event, actions.data ?? [], memberById, teamById.get(event.teamIds[0])?.name ?? '')
    canvas.toBlob((b) => {
      if (!b) return
      setBlob(b)
      setUrl(URL.createObjectURL(b))
      setBusy(false)
    }, 'image/png')
  }

  const share = async () => {
    if (!blob) return
    const f = new File([blob], file, { type: 'image/png' })
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({ files: [f], title: event.title }).catch(() => {})
    } else {
      download()
    }
  }
  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = file
    a.click()
    toast('Grafik gespeichert')
  }

  return (
    <>
      <Button variant="outline" size="lg" className="mt-4 w-full" icon={<ImageDown className="size-5" />} loading={busy} onClick={create}>
        Ergebnis-Grafik für Social Media
      </Button>
      <Sheet
        open={!!url}
        onClose={() => {
          if (url) URL.revokeObjectURL(url)
          setUrl(null)
        }}
        title="Ergebnis-Grafik"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" icon={<Download className="size-4" />} onClick={download}>
              Speichern
            </Button>
            <Button className="flex-1" icon={<Share2 className="size-4" />} onClick={share}>
              Teilen
            </Button>
          </div>
        }
      >
        {url && <img src={url} alt="Ergebnis-Grafik" className="w-full rounded-2xl shadow-lg" />}
      </Sheet>
    </>
  )
}
