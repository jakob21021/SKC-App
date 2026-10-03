// Startet die komplette SKC-App lokal auf dem PC: Datenbank, Anmeldung, E-Mail-Postfach und App.
// Aufruf: npm run lokal   (Windows: Doppelklick auf Start-SKC-App.bat)
//
// Voraussetzung für den Vollbetrieb ist Docker Desktop. Ohne Docker startet die App im Demo-Modus.
import { spawn, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { shell: true, encoding: 'utf8', ...opts })
const line = () => console.log('─'.repeat(64))

function startVite(mode) {
  const args = ['vite', '--open', ...(mode ? ['--mode', mode] : [])]
  const child = spawn('npx', args, { stdio: 'inherit', shell: true })
  child.on('exit', (code) => process.exit(code ?? 0))
}

// 1. Läuft Docker?
const docker = run('docker', ['info'], { stdio: 'pipe' })
if (docker.status !== 0) {
  line()
  console.log('⚠️  Docker Desktop läuft nicht (oder ist nicht installiert).')
  console.log('   Für den Vollbetrieb mit eigener Datenbank: Docker Desktop installieren')
  console.log('   (https://www.docker.com/products/docker-desktop), starten und erneut ausführen.')
  console.log('')
  console.log('   Jetzt startet die App im DEMO-MODUS – alle Daten bleiben nur im Browser.')
  line()
  startVite()
} else {
  // 2. Lokale Supabase starten (beim ersten Mal werden die Bausteine heruntergeladen)
  let status = run('npx', ['supabase', 'status', '-o', 'env'], { stdio: 'pipe' })
  if (status.status !== 0) {
    console.log('🚀 Starte die lokale Datenbank … (beim ersten Mal kann das 5–10 Minuten dauern)')
    const start = run('npx', ['supabase', 'start'], { stdio: 'inherit' })
    if (start.status !== 0) {
      console.error('❌ Die lokale Datenbank konnte nicht gestartet werden. Läuft Docker Desktop?')
      process.exit(1)
    }
    status = run('npx', ['supabase', 'status', '-o', 'env'], { stdio: 'pipe' })
  }

  // 3. Zugangsdaten auslesen und für die App hinterlegen
  const env = Object.fromEntries(
    status.stdout
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  )
  const url = env.API_URL
  const key = env.ANON_KEY || env.PUBLISHABLE_KEY
  const mail = env.MAILPIT_URL || env.INBUCKET_URL || 'http://127.0.0.1:54324'
  const studio = env.STUDIO_URL || 'http://127.0.0.1:54323'
  if (!url || !key) {
    console.error('❌ Konnte die Zugangsdaten der lokalen Datenbank nicht lesen:\n' + status.stdout)
    process.exit(1)
  }
  writeFileSync(
    '.env.lokal.local',
    `# Automatisch erzeugt von scripts/local.mjs – nicht einchecken\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${key}\nVITE_LOCAL_MAIL_URL=${mail}\n`,
  )

  line()
  console.log('✅ Die SKC-App läuft komplett auf deinem PC:')
  console.log('')
  console.log('   App ............... http://localhost:5173')
  console.log(`   E-Mail-Postfach ... ${mail}   (hier kommen die Anmeldecodes an)`)
  console.log(`   Datenbank-Ansicht . ${studio}`)
  console.log('')
  console.log('   Test-Logins: lena@example.org (Spielerin), tim@example.org (Trainer),')
  console.log('                sabine@example.org (Elternteil), andrea@example.org (Vorstand)')
  console.log('')
  console.log('   Beenden: Strg + C. Die Datenbank läuft weiter – stoppen mit: npm run lokal:stop')
  console.log('   Alles auf Anfang (frische Beispieldaten): npm run lokal:reset')
  line()
  startVite('lokal')
}
