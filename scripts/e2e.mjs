// End-to-End-Rauchtest der wichtigsten Abläufe im Demo-Modus.
// Aufruf: npm run build && node scripts/e2e.mjs
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import assert from 'node:assert/strict'

const PORT = 4319
const BASE = `http://localhost:${PORT}/`
const server = await preview({ preview: { port: PORT, strictPort: true }, build: { outDir: process.env.E2E_DIST ?? 'dist' }, logLevel: 'silent' })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const errors = []
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.stack ?? e.message))
  page.setDefaultTimeout(8000)
  return page
}
const step = (name) => console.log('•', name)

try {
  const page = await newPage()

  step('Login-Seite und Demo-Rolle „Spielerin“')
  await page.goto(`${BASE}#/`)
  await page.getByText('Demo ausprobieren').waitFor()
  await page.getByRole('button', { name: /Lena Hoffmann/ }).click()
  await page.getByText('Hallo, Lena!').waitFor()

  step('Training zusagen (Ein-Tipp)')
  const firstCard = page.locator('main').getByRole('button', { name: 'Lena: Dabei' }).first()
  await firstCard.click()
  await page.getByText('Zugesagt – bis dann!').waitFor()
  assert.equal(await firstCard.getAttribute('aria-pressed'), 'true')

  step('Absage mit Grund')
  await page.locator('main').getByRole('button', { name: 'Lena: Nicht dabei' }).nth(1).click()
  await page.getByRole('button', { name: 'Krank' }).click()
  await page.getByRole('button', { name: 'Absage senden' }).click()
  await page.getByText('Abgesagt', { exact: true }).first().waitFor()

  step('Rückmeldungen bleiben nach Neuladen erhalten')
  await page.reload()
  await page.getByText('Hallo, Lena!').waitFor()
  assert.equal(await page.locator('main').getByRole('button', { name: 'Lena: Dabei' }).first().getAttribute('aria-pressed'), 'true')

  step('Helferschicht übernehmen')
  await page.goto(`${BASE}#/helfen/hl-derby`)
  await page.getByRole('button', { name: 'Ich helfe' }).first().click()
  await page.getByText('Danke fürs Helfen!').waitFor()
  await page.goto(`${BASE}#/helfen`)
  await page.getByText('Meine Einsätze').waitFor()

  step('Abwesenheit eintragen')
  await page.goto(`${BASE}#/profil`)
  await page.getByRole('button', { name: 'Eintragen' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await page.getByText(/Eingetragen/).waitFor()

  step('Umfrage abstimmen')
  await page.goto(`${BASE}#/news/n-weihnacht`)
  await page.getByRole('button', { name: /Bowling/ }).click()
  await page.getByText('Stimme gespeichert').waitFor()

  step('Spielerin sieht keine Live-Erfassung')
  await page.goto(`${BASE}#/termine/g-t1-5`)
  await page.getByText('Deine Rückmeldung').waitFor()
  assert.equal(await page.getByRole('button', { name: /Live-Erfassung/ }).count(), 0)

  step('Rollenwechsel zu Trainer')
  await page.goto(`${BASE}#/einstellungen`)
  await page.getByRole('button', { name: 'Andere Rolle ausprobieren' }).click()
  await page.getByRole('button', { name: /Tim Schäfer/ }).click()
  await page.getByText('Hallo, Tim!').waitFor()

  step('Trainer erfasst Spiel live')
  await page.goto(`${BASE}#/termine/g-t1-5/live`)
  await page.getByRole('button', { name: 'Anpfiff' }).click()
  await page.getByText('1. Halbzeit').waitFor()
  await page.getByRole('button', { name: /Lena H\./ }).click()
  await page.getByRole('button', { name: 'Fernwurf' }).first().click()
  await page.getByRole('button', { name: 'Korb Gegner (+1)' }).click()
  await page.getByRole('button', { name: /Lena H\./ }).click()
  await page.getByRole('button', { name: 'Durchlaufball' }).first().click()
  await page.getByText('Fächerwechsel in 1 Korb').waitFor()
  const score = await page.locator('.font-display.text-7xl').allTextContents()
  assert.deepEqual(score, ['2', '1'])

  step('Rückgängig korrigiert den Spielstand')
  await page.getByRole('button', { name: 'Rückgängig' }).first().click()
  await page.waitForFunction(() => [...document.querySelectorAll('.font-display.text-7xl')].map((e) => e.textContent).join(':') === '1:1')

  step('Zuschauer:innen sehen Live-Ticker in anderem Tab')
  const fan = await page.context().newPage()
  await fan.goto(`${BASE}#/termine/g-t1-5`)
  await fan.getByText(/Korb! Lena H\./).waitFor()

  step('Termin anlegen als Trainer')
  await page.goto(`${BASE}#/termine/neu`)
  await page.getByRole('tab', { name: 'Spiel' }).click()
  await page.getByPlaceholder('z. B. KV Adler Rauxel').fill('TuS Testgegner')
  await page.getByRole('button', { name: /Anlegen/ }).click()
  await page.getByText('vs.').first().waitFor()
  await page.getByText('TuS Testgegner').first().waitFor()

  step('Vorstand schaltet Zugangsanfrage frei')
  await page.goto(`${BASE}#/einstellungen`)
  await page.getByRole('button', { name: 'Andere Rolle ausprobieren' }).click()
  await page.getByRole('button', { name: /Andrea Wolff/ }).click()
  await page.getByText('Andrea!').waitFor()
  await page.goto(`${BASE}#/verwaltung`)
  await page.getByRole('button', { name: 'Freischalten' }).first().click()
  await page.getByText(/freigeschaltet/).waitFor()

  step('Gastzugang zeigt keine Teilnehmerlisten')
  const guest = await newPage()
  await guest.goto(`${BASE}#/login`)
  await guest.getByRole('button', { name: /Als Gast ansehen/ }).click()
  await guest.getByText('Willkommen beim SKC!').waitFor()
  await guest.goto(`${BASE}#/termine/g-t1-5`)
  await guest.getByText('Treffpunkt 17:00 Uhr').waitFor()
  assert.equal(await guest.getByText('Wer ist dabei?').count(), 0)

  assert.deepEqual(errors, [], 'Keine JavaScript-Fehler')
  console.log('\n✅ Alle Abläufe funktionieren')
} catch (e) {
  console.error('\n❌', e.message)
  if (errors.length) console.error('JS-Fehler:', errors)
  process.exitCode = 1
} finally {
  await browser.close()
  await server.close()
}
