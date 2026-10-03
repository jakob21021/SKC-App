// Stammdaten des Vereins. Alles, was sich ohne Datenbank pflegen lässt, steht hier.
export const club = {
  name: 'Schweriner KC',
  short: 'SKC',
  fullName: "Schweriner Korfball Club e. V. '67",
  founded: 1967,
  city: 'Castrop-Rauxel',
  claim: 'Korfball mit Herz – seit 1967.',
  website: 'https://www.schwerinerkc.de',
  email: 'vorstand@schwerinerkc.de',
  address: 'Bodelschwingher Str. 35, 44577 Castrop-Rauxel',
  shopUrl: 'https://www.trikot.com/artikel/schweriner-kc-trikot/',
  social: {
    x: 'https://x.com/schwerinerkc',
  },
} as const

// Korfball: Eine Mannschaft steht mit 4 Damen und 4 Herren auf dem Feld.
export const LINEUP = { w: 4, m: 4 } as const
// Nach jeweils zwei Körben (egal welches Team) wechseln die Fächer (Angriff ⇄ Verteidigung).
export const GOALS_PER_ZONE_SWITCH = 2
