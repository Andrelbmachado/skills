// Public-domain artwork from Wikimedia Commons, rate-limit safe.
//   node tools/commons-dl.mjs search "Starry Night Google Art Project" "Wheatfield with crows"
//   node tools/commons-dl.mjs get '{"analog":"File:Van Gogh - Starry Night - Google Art Project.jpg"}'
// `get` writes assets/art/<key>.jpg (1400 px wide) and merges license/page into assets/art/credits.json.
// Burst calls get "You are making too many requests" → ~2.5 s between calls + backoff. Check license before use:
// living artists (e.g. Gerhard Richter) are not public domain — pick a PD substitute and report it.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib.mjs'

const UA = { 'User-Agent': 'NarratedReel/1.0 (educational video; Wikimedia API etiquette)' }
const API = 'https://commons.wikimedia.org/w/api.php?format=json&'
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function get(u, kind) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(u, { headers: UA })
    if (r.ok) {
      if (kind !== 'json') return Buffer.from(await r.arrayBuffer())
      try { return JSON.parse(await r.text()) } catch {}
    }
    await sleep(4000 * (i + 1))
  }
  throw new Error('failed: ' + u)
}
const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'search') {
  for (const q of args) {
    await sleep(2500)
    const j = await get(API + 'action=query&list=search&srnamespace=6&srlimit=6&srsearch=' + encodeURIComponent(q), 'json')
    console.log('==', q); for (const x of j.query.search) console.log('  ', x.title)
  }
} else if (cmd === 'get') {
  const OUT = path.join(ROOT, 'assets/art'); fs.mkdirSync(OUT, { recursive: true })
  const cf = path.join(OUT, 'credits.json')
  const credits = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : []
  for (const [key, title] of Object.entries(JSON.parse(args[0]))) {
    await sleep(2500)
    const j = await get(API + 'action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1400&titles=' + encodeURIComponent(title), 'json')
    const ii = Object.values(j.query.pages)[0].imageinfo[0], m = ii.extmetadata
    await sleep(1500)
    fs.writeFileSync(path.join(OUT, key + '.jpg'), await get(ii.thumburl, 'buf'))
    const c = { key, title, page: ii.descriptionurl, license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value), date: strip(m.DateTimeOriginal?.value), size: `${ii.width}x${ii.height}` }
    const i = credits.findIndex(x => x.key === key); if (i >= 0) credits[i] = c; else credits.push(c)
    console.log(key, '|', c.license, '|', c.artist, '|', c.date)
  }
  fs.writeFileSync(cf, JSON.stringify(credits, null, 1))
} else {
  console.log('usage: commons-dl.mjs search "<query>"... | get \'{"key":"File:..."}\'')
}
