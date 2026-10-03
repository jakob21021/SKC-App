// Erstellt Screenshots der wichtigsten Screens im Handy-Format.
// Aufruf: npm run build && node scripts/screenshots.mjs [ausgabeordner]
// Startet dafür selbst einen `vite preview`-Server.
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { mkdirSync } from 'node:fs'

const out = process.argv[2] ?? 'screenshots/tmp'
const PORT = 4318
const BASE = `http://localhost:${PORT}/`
mkdirSync(out, { recursive: true })

// Laufenden Preview-Server wiederverwenden, sonst selbst starten
const running = await fetch(BASE).then(() => true, () => false)
const server = running ? null : await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

async function session(memberId, { dark = false, width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: dark ? 'dark' : 'light',
    serviceWorkers: 'block',
  })
  await ctx.addInitScript((id) => {
    if (id) localStorage.setItem('skc-demo-session', JSON.stringify({ memberId: id, demo: true }))
  }, memberId)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()))
  return { ctx, page }
}

async function shot(page, hash, name, { full = false, before } = {}) {
  await page.goto(`${BASE}#${hash}`, { timeout: 15000 })
  await page.waitForTimeout(900)
  if (before) await before(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full })
  console.log('✓', name)
}

try {
  // Login
  {
    const { ctx, page } = await session(null)
    await shot(page, '/login', '01-login', { full: true })
    await ctx.close()
  }
  // Spielerin
  {
    const { ctx, page } = await session('m-lena')
    await shot(page, '/', '02-start', { full: true })
    await shot(page, '/termine', '03-termine')
    await shot(page, '/termine/g-t1-5', '04-spiel-derby', { full: true })
    await shot(page, '/termine/g-t2-live', '05-live-ticker', { full: true })
    await shot(page, '/termine/g-t1-4', '06-spiel-statistik', {
      full: true,
      before: (p) => p.getByRole('tab', { name: 'Statistik' }).click(),
    })
    await shot(page, '/spiele', '07-spiele-tabelle', { before: (p) => p.getByRole('tab', { name: 'Tabelle' }).click() })
    await shot(page, '/spiele', '08-spiele-statistik', { full: true, before: (p) => p.getByRole('tab', { name: 'Statistik' }).click() })
    await shot(page, '/helfen', '09-helfen', { full: true })
    await shot(page, '/helfen/hl-derby', '10-helferliste', { full: true })
    await shot(page, '/mehr', '11-mehr', { full: true })
    await shot(page, '/news/n-weihnacht', '12-umfrage', { full: true })
    await shot(page, '/profil', '13-profil', { full: true })
    await shot(page, '/specials', '14-specials', { full: true })
    const training = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('skc-demo-db'))
      return db.events.find((e) => e.kind === 'training' && e.teamIds[0] === 't1' && new Date(e.start) > new Date() && !e.cancelled).id
    })
    await shot(page, `/termine/${training}`, '15-training-absage', {
      before: async (p) => {
        await p.getByRole('button', { name: 'Lena: Nicht dabei' }).first().click()
      },
    })
    await ctx.close()
  }
  // Trainer
  {
    const { ctx, page } = await session('m-tim')
    await shot(page, '/termine/g-t1-5', '16-trainer-spiel', { full: true })
    await ctx.close()
    const s2 = await session('m-tim')
    // Trainer der 1. Mannschaft erfasst ein Spiel live
    await shot(s2.page, '/termine/g-t1-5/live', '17-live-erfassung', { full: true })
    await s2.ctx.close()
  }
  // Elternteil
  {
    const { ctx, page } = await session('m-sabine')
    await shot(page, '/', '18-eltern-start', { full: true })
    await ctx.close()
  }
  // Vorstand
  {
    const { ctx, page } = await session('m-andrea')
    await shot(page, '/verwaltung', '19-verwaltung', { full: true })
    await ctx.close()
  }
  // Dark Mode & Tablet
  {
    const { ctx, page } = await session('m-lena', { dark: true })
    await shot(page, '/', '20-dark-start')
    await ctx.close()
    const t = await session('m-lena', { width: 1024, height: 768 })
    await shot(t.page, '/', '21-tablet')
    await t.ctx.close()
  }
} finally {
  await browser.close()
  await server?.close()
}
