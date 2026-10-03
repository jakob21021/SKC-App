// Rendert SVG-Dateien mit Chromium zu PNG (für App-Icons).
// Aufruf: node scripts/render-svg.mjs <input.svg> <output.png> [size] [hintergrund] [innenabstand]
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const [, , input, output, size = '512', bg = 'transparent', pad = '0'] = process.argv
const svg = readFileSync(input, 'utf8')
const s = Number(size)
const p = Number(pad)
const font = (w, style) =>
  `@font-face{font-family:'Barlow Condensed';font-weight:${w};font-style:${style};src:url('${pathToFileURL(
    resolve(`node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-${w}-${style}.woff2`),
  )}')}`

const html = `<html><head><style>${font(700, 'normal')}${font(800, 'italic')}</style></head>
<body style="margin:0;background:${bg};display:grid;place-items:center;width:${s}px;height:${s}px">
<div style="width:${s - 2 * p}px;height:${s - 2 * p}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
</body></html>`
const file = join(mkdtempSync(join(tmpdir(), 'svg-')), 'render.html')
writeFileSync(file, html)

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const page = await browser.newPage({ viewport: { width: s, height: s } })
await page.goto(pathToFileURL(file).href)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: output, omitBackground: bg === 'transparent' })
await browser.close()
