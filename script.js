const STATES = [
  { name: 'Tamil Nadu', place: 'Meenakshi Amman Temple', city: 'Madurai' },
  { name: 'Kerala', place: 'Alleppey Backwaters', city: 'Alappuzha' },
  { name: 'Karnataka', place: 'Mysore Palace', city: 'Mysuru' },
  { name: 'Rajasthan', place: 'Hawa Mahal', city: 'Jaipur' },
  { name: 'Uttar Pradesh', place: 'Taj Mahal', city: 'Agra' },
  { name: 'Maharashtra', place: 'Gateway of India', city: 'Mumbai' },
  { name: 'Delhi', place: 'India Gate', city: 'New Delhi' },
  { name: 'Punjab', place: 'Golden Temple', city: 'Amritsar' }
];

const SIL = {
  'Tamil Nadu': '<path d="M190 128V100H290V128Z M200 100V80H280V100Z M210 80V62H270V80Z M220 62V46H260V62Z M230 46V32H250V46Z M236 32V22H244V32Z M110 128V92H160V128Z M120 92V78H150V92Z M320 128V92H370V128Z M330 92V78H360V92Z"/>',
  'Kerala': '<path d="M150 128L170 112H330L350 128Z M180 112Q250 62 320 112Z M92 128Q96 90 100 60H104Q100 90 99 128Z M102 60Q70 50 55 70Q85 58 102 64Z M102 60Q135 50 150 70Q120 58 102 64Z M400 128Q404 96 408 74H411Q408 96 407 128Z M410 74Q382 66 370 84Q394 72 410 78Z M410 74Q438 66 450 84Q426 72 410 78Z"/>',
  'Karnataka': '<path d="M110 128V96H370V128Z M220 96V62H260V96Z M214 62Q240 20 266 62Z M120 96V78H150V96Z M124 78Q135 58 146 78Z M330 96V78H360V96Z M334 78Q345 58 356 78Z M170 96V84H200V96Z M280 96V84H310V96Z"/>',
  'Rajasthan': '<path d="M150 128V104H330V128Z M165 104V82H315V104Z M180 82V62H300V82Z M195 62V46H285V62Z M210 46V34H270V46Z M226 34L240 12L254 34Z"/>',
  'Uttar Pradesh': '<path d="M180 128V100H200V128Z M280 128V100H300V128Z M200 128V84H280V128Z M205 84Q240 20 275 84Z M238 36H242V14H238Z M160 128V62H172V128Z M308 128V62H320V128Z M159 62Q166 46 173 62Z M307 62Q314 46 321 62Z"/>',
  'Maharashtra': '<path fill-rule="evenodd" d="M150 128V70H330V128Z M220 128V92Q240 72 260 92V128Z"/><path d="M150 70V54H166V70Z M314 70V54H330V70Z M148 54Q158 40 168 54Z M312 54Q322 40 332 54Z M215 70V60H265V70Z"/>',
  'Delhi': '<path fill-rule="evenodd" d="M180 128V50H300V128Z M222 128V86Q240 64 258 86V128Z"/><path d="M172 50H308V40H172Z M160 128V118H320V128Z"/>',
  'Punjab': '<path d="M150 128V108H330V128Z M205 108V80H275V108Z M210 80Q240 36 270 80Z M239 44H241V26H239Z M185 108V90H205V108Z M275 108V90H295V108Z M187 90Q195 76 203 90Z M277 90Q285 76 293 90Z"/>'
};

const $ = s => document.querySelector(s);
const els = {
  place: $('#place'), msg: $('#msg'), now: $('#now'), msgs: $('#msgs'), times: $('#times'), details: $('#details'), week: $('#week'),
  country: $('#country'), state: $('#state'), land: $('#land'), fx: $('#fx'), back: $('#back'), sky: $('.sky'), q: $('#q'), list: $('#list'),
  clockTime: $('#clockTime'), clockDate: $('#clockDate'), clockZone: $('#clockZone'), stage: $('#stage'), photos: $('#photos'), credit: $('#credit'), sun: $('#sun')
};
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
let data = null, cur = null, ctrl = null, photoSeq = 0, photoTimer = null, lastQ = '', countries = [], skyKind = '', clockTimer = null, fmtTime = null, fmtDate = null;
let fahrenheit = false;
try { fahrenheit = localStorage.getItem('unit') === 'F'; } catch {}

const say = t => { els.msg.textContent = t; };
const failMsg = e => say(navigator.onLine ? e.message : 'You are offline. Check your connection.');

// One place for every request, so the error message says which service failed
async function api(url, what, opts) {
  let r;
  try { r = await fetch(url, opts); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Could not reach the ' + what + '. Check your connection and try again.');
  }
  if (!r.ok) throw new Error('The ' + what + ' returned an error (' + r.status + '). Please try again.');
  return r.json();
}

// WMO weather code to label and kind
function info(c) {
  if (c === 0) return ['Clear sky', 'clear'];
  if (c < 3) return ['Partly cloudy', 'clear'];
  if (c === 3) return ['Cloudy', 'cloud'];
  if (c < 50) return ['Fog', 'fog'];
  if (c < 58) return ['Drizzle', 'rain'];
  if (c < 68) return ['Rain', 'rain'];
  if (c < 78) return ['Snow', 'snow'];
  if (c < 83) return ['Rain showers', 'rain'];
  if (c < 87) return ['Snow showers', 'snow'];
  return ['Thunderstorm', 'rain'];
}

/* ---------- finding places ---------- */

async function geocode(name, cc) {
  const p = { name, count: cc ? 10 : 5, language: 'en', format: 'json' };
  if (cc) p.countryCode = cc;
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  u.search = new URLSearchParams(p);
  return (await api(u, 'place search')).results || [];
}

// OpenStreetMap knows dams, temples, falls, villages and whole states
async function nominatim(q) {
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.search = new URLSearchParams({ q, format: 'jsonv2', addressdetails: 1, limit: 5, 'accept-language': 'en' });
  return (await api(u, 'map search')).map(x => {
    const a = x.address || {};
    return {
      name: x.name || x.display_name.split(',')[0], latitude: +x.lat, longitude: +x.lon,
      admin1: a.state || '', admin2: a.county || a.state_district || '', country: a.country || '', country_code: (a.country_code || '').toUpperCase()
    };
  });
}

// Photon is tolerant of spelling mistakes ("nanguneri", "nankuneri"), so it catches what exact matching misses
async function photon(q) {
  const u = new URL('https://photon.komoot.io/api/');
  u.search = new URLSearchParams({ q, limit: 6, lang: 'en' });
  return ((await api(u, 'place finder')).features || []).map(f => {
    const p = f.properties || {};
    return {
      name: p.name || '', latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0],
      admin1: p.state || '', admin2: p.county || p.district || '', country: p.country || '', country_code: (p.countrycode || '').toUpperCase()
    };
  }).filter(x => x.name);
}

const tidy = n => n.replace(/\(.*?\)/g, '').replace(/\b(state of|province|region|governorate|prefecture|district|county|territory|municipality|department)\b/gi, '').replace(/\s+/g, ' ').trim();

// Names from the state and capital lists do not always match the geocoder, so try tidy names, then OpenStreetMap
async function resolve(name, country, cc, admin) {
  for (const t of new Set([name, tidy(name)])) {
    if (!t) continue;
    const res = await geocode(t, cc);
    const hit = (admin && res.find(x => x.feature_code === 'ADM1')) || res.find(x => (x.admin1 || '').toLowerCase() === t.toLowerCase()) || res[0];
    if (hit) return hit;
  }
  return (await nominatim(name + ', ' + country))[0];
}

const GENERIC = /\b(dam|temple|falls|waterfalls?|lake|fort|palace|beach|national park|reservoir|hills?|forest|reserve|sanctuary)\b/gi;
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const km = (a, b) => Math.hypot((a.longitude - b.longitude) * Math.cos(a.latitude * Math.PI / 180), a.latitude - b.latitude) * 111;

// Common spelling differences in Indian place names (ai/ay, double letters, th/t, ee/i ...)
function variants(v) {
  const base = norm(v), out = new Set([base]);
  [[/ai/g, 'ay'], [/ay/g, 'ai'], [/ee/g, 'i'], [/oo/g, 'u'], [/th/g, 't'], [/dh/g, 'd'], [/zh/g, 'l'], [/(.)\1/g, '$1']]
    .forEach(([re, to]) => { const x = base.replace(re, to); if (x !== base) out.add(x); });
  return [...out];
}

// Exact name first, then names that start with the text, then the rest; "Name, District" narrows the match
function rank(list, name, ctx) {
  const q = norm(name), out = [];
  for (const r of list) {
    const n = norm(r.name);
    if (out.some(o => norm(o.name) === n && km(o, r) < 15)) continue; // same place from another service
    let score = n === q ? 100 : n.startsWith(q) ? 60 : n.includes(q) ? 30 : q.includes(n) ? 10 : 0;
    if (ctx.length) score += ctx.every(c => norm([r.admin2, r.admin1, r.country].join(' ')).includes(c)) ? 40 : -20;
    out.push({ ...r, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

async function findPlaces(v) {
  const parts = v.split(',').map(x => x.trim()).filter(Boolean);
  const name = parts[0], ctx = parts.slice(1).map(norm);
  const words = name.split(/\s+/).filter(w => w.length > 3).reverse();
  const tries = [name, ...variants(name), name.replace(GENERIC, '').trim(), ...words].filter((t, i, a) => t && a.indexOf(t) === i).slice(0, 7);
  let found = [], firstErr = null;
  for (const t of tries) {
    const got = await Promise.allSettled([geocode(t), photon(t)]);
    got.forEach(g => g.status === 'fulfilled' ? found.push(...g.value) : (firstErr = firstErr || g.reason));
    if (rank(found, name, ctx).some(r => r.score >= 60)) break; // a good match, no need to try other spellings
  }
  if (!found.length) {
    try { found = await nominatim(v); } catch (e) { firstErr = firstErr || e; }
  }
  if (!found.length && firstErr) throw firstErr;
  return rank(found, name, ctx).slice(0, 6);
}

/* ---------- weather ---------- */

async function load(p) {
  if (ctrl) ctrl.abort();
  ctrl = new AbortController();
  busy(true);
  try {
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    u.search = new URLSearchParams({
      latitude: p.lat, longitude: p.lon, timezone: 'auto', forecast_days: 7,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl,cloud_cover',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max'
    });
    const j = await api(u, 'weather service', { signal: ctrl.signal });
    if (!j.current || !j.daily || !j.hourly) throw new Error('The weather service sent unexpected data.');
    data = j; cur = p; say(''); draw();
  } catch (e) {
    if (e.name !== 'AbortError') failMsg(e);
  } finally {
    busy(false);
  }
}

function busy(on) {
  document.body.classList.toggle('loading', on);
  $('#search button').disabled = on;
}

function draw() {
  const c = data.current, h = data.hourly, d = data.daily, [label, kind] = info(c.weather_code);
  const n = v => Math.round(fahrenheit ? v * 9 / 5 + 32 : v);
  const T = v => n(v) + '\u00b0';
  const W = v => Math.round(fahrenheit ? v * 0.621 : v) + (fahrenheit ? ' mph' : ' km/h');
  const hm = t => t.slice(11, 16);
  els.place.textContent = cur.label;
  els.now.innerHTML = `<p class="small">${esc(cur.label.split(' \u00b7 ').pop())}</p>
    <p class="temp" aria-live="polite">${n(c.temperature_2m)}<span class="deg">\u00b0</span><small>${fahrenheit ? 'F' : 'C'}</small></p>
    <p class="cond">${label}</p><p class="small">Feels like ${T(c.apparent_temperature)}</p>`;
  const uv = (d.uv_index_max || [])[0];
  els.details.innerHTML = [
    ['Humidity', c.relative_humidity_2m + '%'], ['Wind', W(c.wind_speed_10m)], ['Gusts', W(c.wind_gusts_10m)],
    ['Pressure', Math.round(c.pressure_msl) + ' hPa'], ['Cloud cover', c.cloud_cover + '%'], ['UV index', uv == null ? '-' : Math.round(uv)]
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  els.times.textContent = `Sunrise ${hm(d.sunrise[0])} \u00b7 Sunset ${hm(d.sunset[0])}`;
  const i = Math.max(0, h.time.findIndex(t => t >= c.time.slice(0, 13)));
  const rows = [`<li><b>Now</b> ${label} \u00b7 ${T(c.temperature_2m)}</li>`];
  for (let k = i + 2; k < h.time.length && rows.length < 8; k += 3)
    rows.push(`<li><b>${hm(h.time[k])}</b> ${info(h.weather_code[k])[0]} \u00b7 ${T(h.temperature_2m[k])} \u00b7 ${h.precipitation_probability[k] ?? 0}% rain</li>`);
  els.msgs.innerHTML = rows.join('');
  els.week.innerHTML = d.time.map((t, k) => `<li><b>${k ? new Date(t + 'T00:00').toLocaleDateString('en', { weekday: 'short' }) : 'Today'}</b>
    <span>${info(d.weather_code[k])[0]}</span><strong>${T(d.temperature_2m_max[k])} <em>${T(d.temperature_2m_min[k])}</em></strong>
    <span>${d.precipitation_probability_max[k] ?? 0}% rain</span></li>`).join('');
  document.title = T(c.temperature_2m) + ' ' + cur.label.split(' \u00b7 ')[0] + ' | Weather Dashboard';
  skyKind = kind;
  applyTheme(kind);
  orb(kind);
  startClock();
  setLand(cur.state);
  const key = String(cur.photoQ || cur.label) + cur.lat.toFixed(2) + cur.lon.toFixed(2);
  if (lastQ !== key) { lastQ = key; photos(cur); }
}

/* ---------- sky: theme, sun and moon, particles ---------- */

// Theme follows the city's local time and the weather
function skyTheme(kind) {
  const m = 60000, t = +new Date(data.current.time);
  const rise = +new Date(data.daily.sunrise[0]), set = +new Date(data.daily.sunset[0]);
  let time = 'day';
  if (t < rise - 30 * m || t > set + 45 * m) time = 'night';
  else if (t > set - 60 * m || t < rise + 45 * m) time = 'evening';
  const theme = time !== 'day' ? time : kind === 'rain' ? 'rain' : kind === 'cloud' ? 'cloudy' : (kind === 'fog' || kind === 'snow') ? 'mist' : 'day';
  return new URLSearchParams(location.search).get('theme') || theme;
}

function applyTheme(kind) {
  const theme = skyTheme(kind);
  if (theme === 'rain') kind = 'rain';
  document.body.dataset.theme = theme;
  document.body.classList.toggle('storm', data.current.weather_code >= 95);
  els.sky.style.animation = 'none'; void els.sky.offsetWidth; els.sky.style.animation = '';
  effects(theme, kind);
}

// The sun travels from sunrise to sunset, the moon through the night
function orb(kind) {
  const day = 86400000, t = +new Date(data.current.time);
  const r = +new Date(data.daily.sunrise[0]), s = +new Date(data.daily.sunset[0]);
  let p = (t - r) / (s - r), moon = false;
  if (p < 0 || p > 1) { moon = true; p = (t > s ? t - s : t + day - s) / (day - (s - r)); }
  const lift = Math.sin(p * Math.PI);
  const e = els.sun;
  e.className = 'orb' + (moon ? ' moon' : '');
  e.style.left = 8 + p * 84 + '%';
  e.style.top = 82 - lift * 74 + '%';
  e.style.opacity = (['rain', 'cloud', 'fog', 'snow'].includes(kind) ? 0.4 : 1) * (moon ? 1 : 0.5 + 0.5 * lift);
  els.sky.style.setProperty('--dim', moon ? 0 : ((1 - lift) * 0.3).toFixed(2));
}

function effects(theme, kind) {
  els.fx.innerHTML = ''; els.back.innerHTML = '';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = Math.random;
  const add = (box, count, cls, set) => {
    for (let k = 0; k < count; k++) { const e = document.createElement('i'); e.className = cls; set(e.style); box.append(e); }
  };
  if (kind === 'rain') add(els.fx, innerWidth < 700 ? 45 : 90, 'drop', s => { s.left = r() * 100 + '%'; s.animationDelay = -r() * 2 + 's'; s.animationDuration = 0.6 + r() * 0.5 + 's'; });
  else if (kind === 'snow') add(els.fx, 45, 'flake', s => { s.left = r() * 100 + '%'; s.animationDelay = -r() * 8 + 's'; s.animationDuration = 6 + r() * 5 + 's'; });
  add(els.back, { clear: 3, cloud: 6, rain: 7, fog: 4, snow: 5 }[kind] || 3, 'cloud', s => {
    s.top = r() * 55 + '%'; s.width = 220 + r() * 260 + 'px'; s.height = 60 + r() * 50 + 'px';
    s.animationDuration = 70 + r() * 80 + 's'; s.animationDelay = -r() * 120 + 's';
  });
  if (theme === 'night' && kind !== 'rain') {
    add(els.back, 90, 'star', s => { s.left = r() * 100 + '%'; s.top = r() * 70 + '%'; s.animationDelay = -r() * 4 + 's'; });
    add(els.back, 1, 'meteor', s => { s.top = r() * 30 + '%'; s.left = 40 + r() * 50 + '%'; });
  }
}

function setLand(name) {
  const l = els.land;
  l.classList.remove('in');
  if (!name || !SIL[name]) { l.innerHTML = ''; return; }
  l.innerHTML = `<svg viewBox="0 0 480 140" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${SIL[name]}<path d="M0 140V128H480V140Z"/></svg>`;
  void l.offsetWidth;
  l.classList.add('in');
}

/* ---------- live clock of the place that is shown ---------- */

function startClock() {
  const tz = data.timezone, secs = data.utc_offset_seconds || 0;
  try {
    fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    fmtDate = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
  } catch { fmtTime = fmtDate = null; } // unknown time zone name, the browser's own time is shown instead
  const a = Math.abs(secs), m = Math.round(a % 3600 / 60);
  const utc = 'UTC' + (secs < 0 ? '-' : '+') + Math.floor(a / 3600) + (m ? ':' + String(m).padStart(2, '0') : '');
  const c = countries.find(x => x.code === els.country.value);
  els.clockZone.textContent = (c ? c.name : String(tz || 'Local').split('/').pop().replace(/_/g, ' ')) + ' time \u00b7 ' + utc;
  clearInterval(clockTimer);
  tick();
  clockTimer = setInterval(tick, 1000);
}

function tick() {
  const now = new Date();
  els.clockTime.textContent = fmtTime ? fmtTime.format(now) : now.toLocaleTimeString();
  els.clockDate.textContent = fmtDate ? fmtDate.format(now) : now.toDateString();
  if (now.getSeconds() === 0) refreshSky(now);
}

// Once a minute the sun or moon moves on and the sky changes when sunset or sunrise arrives
function refreshSky(now) {
  if (!data) return;
  try {
    data.current.time = new Intl.DateTimeFormat('sv-SE', { timeZone: data.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(now).replace(' ', 'T');
  } catch { return; }
  orb(skyKind);
  if (skyTheme(skyKind) !== document.body.dataset.theme) applyTheme(skyKind);
}

/* ---------- photos from Wikimedia Commons (free licences, no key) ---------- */

// Landmarks are found by name. Any other place uses photos geotagged within 3 km (then 10 km) of its coordinates, so they show that place.
async function photos(p) {
  const seq = ++photoSeq;
  clearInterval(photoTimer);
  els.photos.innerHTML = ''; els.credit.textContent = '';
  els.stage.classList.remove('has-photo');
  const query = async extra => {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    u.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: 1200, ...extra });
    const pages = ((await api(u, 'photo service')).query || {}).pages || {};
    return Object.values(pages).sort((a, b) => (a.index || 0) - (b.index || 0)).map(x => x.imageinfo && x.imageinfo[0])
      .filter(i => i && i.thumburl && i.mime === 'image/jpeg' && i.width >= 900 && i.width >= i.height).slice(0, 6);
  };
  const byName = async () => {
    for (const q of [].concat(p.photoQ || p.label)) {
      const l = await query({ generator: 'search', gsrsearch: q + ' filetype:bitmap', gsrnamespace: 6, gsrlimit: 12 });
      if (l.length) return [l, q];
    }
    return [[], ''];
  };
  const byPlace = async () => {
    for (const radius of [3000, 10000]) {
      const l = await query({ generator: 'geosearch', ggscoord: p.lat + '|' + p.lon, ggsradius: radius, ggsnamespace: 6, ggslimit: 40 });
      if (l.length >= 3) return [l, p.label];
    }
    return [[], ''];
  };
  try {
    let list = [], used = '';
    for (const step of p.landmark ? [byName, byPlace] : [byPlace, byName]) {
      [list, used] = await step();
      if (list.length || seq !== photoSeq) break;
    }
    if (!list.length || seq !== photoSeq) return;
    const meta = i => ((i.extmetadata.Artist || {}).value || 'Unknown').replace(/<[^>]*>/g, '').trim() + ' (' + ((i.extmetadata.LicenseShortName || {}).value || 'open licence') + ')';
    els.photos.innerHTML = list.map(i => `<img src="${esc(i.thumburl)}" alt="${esc(used)}" onerror="this.remove()">`).join('');
    const imgs = [...els.photos.children], credits = list.map(meta);
    let k = 0;
    const show = i => { imgs.forEach((e, j) => e.classList.toggle('on', j === i)); els.credit.textContent = 'Photo: ' + credits[i] + ' / Wikimedia Commons'; };
    show(0);
    els.stage.classList.add('has-photo');
    if (imgs.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) photoTimer = setInterval(() => show(k = (k + 1) % imgs.length), 5000);
  } catch { /* photos are optional, the silhouette stays as the fallback */ }
}

/* ---------- countries, states and search ---------- */

// Used when the country list service cannot be reached
const FALLBACK = ('IN|India|New Delhi,US|United States|Washington,GB|United Kingdom|London,FR|France|Paris,DE|Germany|Berlin,IT|Italy|Rome,ES|Spain|Madrid,'
  + 'MX|Mexico|Mexico City,CA|Canada|Ottawa,BR|Brazil|Brasilia,AR|Argentina|Buenos Aires,AU|Australia|Canberra,NZ|New Zealand|Wellington,JP|Japan|Tokyo,'
  + 'CN|China|Beijing,KR|South Korea|Seoul,SG|Singapore|Singapore,MY|Malaysia|Kuala Lumpur,TH|Thailand|Bangkok,ID|Indonesia|Jakarta,LK|Sri Lanka|Colombo,'
  + 'NP|Nepal|Kathmandu,BD|Bangladesh|Dhaka,PK|Pakistan|Islamabad,AE|United Arab Emirates|Abu Dhabi,SA|Saudi Arabia|Riyadh,QA|Qatar|Doha,RU|Russia|Moscow,'
  + 'TR|Turkey|Ankara,EG|Egypt|Cairo,ZA|South Africa|Pretoria,NG|Nigeria|Abuja,KE|Kenya|Nairobi,NL|Netherlands|Amsterdam,CH|Switzerland|Bern,'
  + 'SE|Sweden|Stockholm,NO|Norway|Oslo,IE|Ireland|Dublin,PT|Portugal|Lisbon,GR|Greece|Athens').split(',')
  .map(x => { const [code, name, capital] = x.split('|'); return { name, official: name, code, capital }; });

async function loadCountries() {
  try {
    const j = await api('https://restcountries.com/v3.1/all?fields=name,cca2,capital', 'country list');
    countries = j.map(c => ({ name: c.name.common, official: c.name.official, code: c.cca2, capital: (c.capital || [])[0] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    countries = FALLBACK;
    say('The full country list could not be loaded, showing the main countries. Search still works for any place.');
  }
  els.country.innerHTML = '<option value="">Choose a country</option>' + countries.map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('');
}

// All states or regions of the chosen country
async function loadRegions(c) {
  els.state.innerHTML = '<option value="">Loading states</option>';
  const ask = async name => ((await api('https://countriesnow.space/api/v0.1/countries/states', 'state list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: name })
  })).data || {}).states || [];
  let list = [];
  try { list = await ask(c.name); if (!list.length) list = await ask(c.official); } catch { /* menu shows "No states listed" */ }
  if (els.country.value !== c.code) return;
  els.state.innerHTML = '<option value="">' + (list.length ? 'Choose a state' : 'No states listed') + '</option>' + list.map(x => `<option>${esc(x.name)}</option>`).join('');
}

function syncCountry(code) {
  if (els.country.value === code) return;
  els.country.value = code;
  const c = countries.find(x => x.code === code);
  if (c) loadRegions(c);
}

function markChip(name) { els.state.value = name || ''; }

async function pickState(s) {
  try {
    say('');
    const hit = await resolve(s.city, 'India', 'IN', false);
    if (!hit) { say('Could not find ' + s.city + '.'); return; }
    markChip(s.name);
    load({ lat: hit.latitude, lon: hit.longitude, label: `${s.place} \u00b7 ${s.city}, ${s.name}`, state: s.name, photoQ: s.place, landmark: true });
  } catch (e) { failMsg(e); }
}

async function pickCountry(code) {
  const c = countries.find(x => x.code === code);
  if (!c) return;
  els.country.value = code;
  loadRegions(c);
  if (code === 'IN') { pickState(STATES.find(s => s.name === 'Delhi')); return; }
  try {
    say('');
    const city = c.capital || c.name;
    const hit = await resolve(city, c.name, code, false);
    if (!hit) { say('Could not find ' + city + '.'); return; }
    markChip();
    load({ lat: hit.latitude, lon: hit.longitude, label: `${city}, ${c.name}`, photoQ: [`${city} ${c.name}`, c.name] });
  } catch (e) { failMsg(e); }
}

async function pickRegion(name) {
  if (!name) return;
  const code = els.country.value, c = countries.find(x => x.code === code), where = c ? c.name : '';
  const known = code === 'IN' && STATES.find(s => s.name === name);
  if (known) { pickState(known); return; }
  try {
    say('');
    const hit = await resolve(name, where, code, true);
    if (!hit) { say('Could not find ' + name + '.'); return; }
    load({ lat: hit.latitude, lon: hit.longitude, label: `${name}, ${where}`, photoQ: [`${name} ${where}`, where] });
  } catch (e) { failMsg(e); }
}

function pickPlace(r) {
  if (r.country_code) syncCountry(r.country_code);
  const s = STATES.find(x => x.city.toLowerCase() === r.name.toLowerCase() && (r.admin1 || '').toLowerCase() === x.name.toLowerCase());
  markChip(s && s.name);
  const district = r.admin2 && norm(r.admin2) !== norm(r.name) ? r.admin2 : '';
  load({
    lat: r.latitude, lon: r.longitude, state: s && s.name, landmark: !!s,
    label: [r.name, district, r.admin1, r.country].filter(Boolean).join(', '),
    photoQ: s ? s.place : [`"${r.name}" ${r.country || ''}`, `${r.name} ${r.admin1 || ''}`]
  });
}

async function onSearch(e) {
  e.preventDefault();
  const v = els.q.value.trim();
  els.list.hidden = true;
  if (v.length < 2 || !/^[\p{L}\p{M}\s.,'-]+$/u.test(v)) { say('Enter a place name using letters only (at least 2).'); return; }
  try {
    say('');
    const lc = v.toLowerCase();
    const co = countries.find(x => x.name.toLowerCase() === lc);
    if (co) { pickCountry(co.code); return; }
    const ind = STATES.find(x => x.name.toLowerCase() === lc);
    if (ind) { syncCountry('IN'); pickState(ind); return; }
    const rg = [...els.state.options].find(o => o.value && o.value.toLowerCase() === lc);
    if (rg) { els.state.value = rg.value; pickRegion(rg.value); return; }
    const res = await findPlaces(v);
    if (!res.length) { say('Could not find "' + v + '". Try the nearest town, or add the district name, like "Nanguneri, Tirunelveli".'); return; }
    const exact = res.filter(r => r.score >= 100);
    if (res.length === 1 || (exact.length === 1 && res[0] === exact[0])) { pickPlace(res[0]); return; }
    els.list._res = res;
    els.list.innerHTML = res.map((r, i) => `<li><button type="button" data-i="${i}"><b>${esc(r.name)}</b> \u00b7 ${esc([r.admin2, r.admin1, r.country].filter(Boolean).join(', '))}</button></li>`).join('');
    els.list.hidden = false;
  } catch (err) { failMsg(err); }
}

els.country.addEventListener('change', () => pickCountry(els.country.value));
els.state.addEventListener('change', () => pickRegion(els.state.value));
els.list.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) { els.list.hidden = true; pickPlace(els.list._res[+b.dataset.i]); }
});
$('#search').addEventListener('submit', onSearch);
$('#geo').addEventListener('click', () => {
  if (!navigator.geolocation) { say('Location is not supported in this browser.'); return; }
  navigator.geolocation.getCurrentPosition(
    p => { markChip(); load({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Your location' }); },
    () => say('Location permission was denied. Search for a place instead.'));
});
$('#unit').textContent = fahrenheit ? '\u00b0F' : '\u00b0C';
$('#unit').addEventListener('click', function () {
  fahrenheit = !fahrenheit;
  try { localStorage.setItem('unit', fahrenheit ? 'F' : 'C'); } catch {}
  this.textContent = fahrenheit ? '\u00b0F' : '\u00b0C';
  if (data) draw();
});

pickState(STATES.find(s => s.name === 'Delhi'));
loadCountries().then(() => { syncCountry('IN'); if (data) startClock(); });
