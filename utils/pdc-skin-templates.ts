/**
 * pdc-skin-templates.ts – Bot-Skin-Templates für PDC + PDC-Europe (v2.9.78)
 *
 * Kombiniert die bestehende `PDC_OPPONENTS`-Liste aus career-engine.ts mit
 *   • Nicknames („The Nuke", „Snakebite" usw.)
 *   • Länder-Flag-Emojis
 *   • zusätzlichen PDC-Europe-Tour-Card-Holdern
 */

import { PDC_OPPONENTS } from "@/utils/career-engine";
import type { CareerOpponent } from "@/utils/career-engine";

// ─── Nickname-Datenbank (IDs müssen mit career-engine.ts übereinstimmen) ───
const NICKNAMES: Record<string, { nickname: string; walkOn?: string }> = {
  llittler:    { nickname: "The Nuke",           walkOn: "Give Me Everything (Pitbull)" },
  lhumphreys:  { nickname: "Cool Hand Luke",     walkOn: "The Boys Are Back In Town" },
  gvv:         { nickname: "The Giant" },
  mvg:         { nickname: "Mighty Mike",        walkOn: "Seven Nation Army" },
  jclayton:    { nickname: "The Ferret",         walkOn: "Bad Wolves – Zombie" },
  jwade:       { nickname: "The Machine",        walkOn: "Untouchable" },
  gprice:      { nickname: "The Iceman",         walkOn: "Livin' on a Prayer" },
  jrock:       { nickname: "Rock the Baby" },
  sbunting:    { nickname: "The Bullet",         walkOn: "Rockstar" },
  dnoppert:    { nickname: "The Freeze" },
  rsearle:     { nickname: "Heavy Metal" },
  ganderson:   { nickname: "The Flying Scotsman", walkOn: "Alan Jackson – Chattahoochee" },
  cdobey:      { nickname: "Hollywood" },
  wnijman:     { nickname: "The Talent" },
  rsmith:      { nickname: "Smudger" },
  naspinall:   { nickname: "The Asp",            walkOn: "The Cranberries – Zombie" },
  jwattimena:  { nickname: "The Machine Gun" },
  mschindler:  { nickname: "The Wall" },
  mde_decker:  { nickname: "The Real Deal" },
  lwoodhouse:  { nickname: "The Yankee" },
  dheta:       { nickname: "The Heat" },
  kratajski:   { nickname: "The Polish Eagle" },
  rcross:      { nickname: "Voltage",            walkOn: "AC/DC – Thunderstruck" },
  dgurney:     { nickname: "Superchin" },
  dchisnall:   { nickname: "Chizzy",             walkOn: "You Don't Have To Be a Star" },
  rjoyce:      { nickname: "Relentless" },
  dvduvij:     { nickname: "The Aubergine" },
  agilding:    { nickname: "Goldfinger" },
  cmenzies:    { nickname: "The Wildcard" },
  redhouse:    { nickname: "Redz" },
  msmith:      { nickname: "Bully Boy",          walkOn: "Enter Sandman" },
  pwright:     { nickname: "Snakebite",          walkOn: "Pitbull – Don't Stop the Party" },
  kdoets:      { nickname: "The Rock" },
  jcullen:     { nickname: "The Rockstar",       walkOn: "Chasing Cars" },
  rpietreczko: { nickname: "Pikachu",            walkOn: "Pokémon Theme" },
  dvdbergh:    { nickname: "The DreamMaker",     walkOn: "Rasputin" },
  rvbarneveld: { nickname: "Barney",             walkOn: "Eye of the Tiger" },
  gclemens:    { nickname: "Der German Giant" },
  msuljovic:   { nickname: "The Gentle" },
  mvandenbog:  { nickname: "The Machine" },
  mhopp:       { nickname: "Maximiser" },
  bbrooks:     { nickname: "The Truth" },
  dgruellich:  { nickname: "The Grinder" },
  kgotthardt:  { nickname: "K-God" },
  bgreaves:    { nickname: "Beau 'n' Arrow" },
  lashton:     { nickname: "The Lancashire Rose" },
  fsherrock:   { nickname: "Queen of the Palace", walkOn: "Girls Just Want to Have Fun" },
};

// ─── PDC-Europe zusätzliche Tour Card Holder & Regional-Stars ───────────────
// Bewusst NICHT enthalten sind Spieler, die schon in PDC_OPPONENTS stehen
// (Bunting, Noppert, Van der Voort, Soutar, Van Peer, Zonneveld, …).
const PDC_EUROPE_EXTRA: CareerOpponent[] = [
  { id: 'nkurz',       name: 'Nico Kurz',           country: 'GER', averageMin: 76, averageMax: 96, checkoutRateMin: 32, checkoutRateMax: 42, worldRanking: 55, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'Nico', isPdcEurope: true },
  { id: 'fhempel',     name: 'Florian Hempel',      country: 'GER', averageMin: 74, averageMax: 94, checkoutRateMin: 30, checkoutRateMax: 40, worldRanking: 60, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'The Vulture', isPdcEurope: true },
  { id: 'revans',      name: 'Ricky Evans',         country: 'ENG', averageMin: 73, averageMax: 91, checkoutRateMin: 28, checkoutRateMax: 38, worldRanking: 80, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'Rapid', isPdcEurope: true },
  { id: 'ksedlacek',   name: 'Karel Sedlacek',      country: 'CZE', averageMin: 72, averageMax: 90, checkoutRateMin: 27, checkoutRateMax: 37, worldRanking: 85, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'Karlos', isPdcEurope: true },
  { id: 'dslevin',     name: 'Dylan Slevin',        country: 'IRE', averageMin: 74, averageMax: 92, checkoutRateMin: 29, checkoutRateMax: 39, worldRanking: 87, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, isPdcEurope: true },
  { id: 'awarner',     name: 'Andy Warner',         country: 'ENG', averageMin: 70, averageMax: 87, checkoutRateMin: 26, checkoutRateMax: 36, worldRanking: 92, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, isPdcEurope: true },
  { id: 'obates',      name: 'Owen Bates',          country: 'ENG', averageMin: 72, averageMax: 89, checkoutRateMin: 27, checkoutRateMax: 37, worldRanking: 94, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, isPdcEurope: true },
  { id: 'ssosing',     name: 'Sandro Eric Sosing',  country: 'PHI', averageMin: 68, averageMax: 84, checkoutRateMin: 22, checkoutRateMax: 32, worldRanking: 110, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, isPdcEurope: true },
  { id: 'jjonsson',    name: 'Jeffrey de Zwaan',    country: 'NED', averageMin: 74, averageMax: 92, checkoutRateMin: 28, checkoutRateMax: 38, worldRanking: 98, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'The Black Cobra', isPdcEurope: true },
  { id: 'jvertongen',  name: 'Kim Huybrechts',      country: 'BEL', averageMin: 74, averageMax: 91, checkoutRateMin: 28, checkoutRateMax: 38, worldRanking: 90, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'The Hurricane', isPdcEurope: true },
  { id: 'rhorvat',     name: 'Rowby-John Rodriguez', country: 'AUT', averageMin: 72, averageMax: 89, checkoutRateMin: 26, checkoutRateMax: 36, worldRanking: 100, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'Little Rowby', isPdcEurope: true },
  { id: 'hkim',        name: 'Haruki Muramatsu',    country: 'JPN', averageMin: 71, averageMax: 88, checkoutRateMin: 25, checkoutRateMax: 35, worldRanking: 130, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, isPdcEurope: false },
  { id: 'lprydzy',     name: 'Krzysztof Prydzy',    country: 'POL', averageMin: 70, averageMax: 87, checkoutRateMin: 24, checkoutRateMax: 34, worldRanking: 125, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, isPdcEurope: true },
  { id: 'jrichardsonx', name: 'James Richardson',   country: 'ENG', averageMin: 73, averageMax: 90, checkoutRateMin: 27, checkoutRateMax: 37, worldRanking: 82, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'The Right Reverend', isPdcEurope: true },
  { id: 'jklaasen',    name: 'Jelle Klaasen',       country: 'NED', averageMin: 76, averageMax: 93, checkoutRateMin: 29, checkoutRateMax: 40, worldRanking: 70, isNemesis: false, rivalryWins: 0, rivalryLosses: 0, nickname: 'The Cobra', isPdcEurope: true },
];

// ─── ISO-Land → Emoji-Flag ─────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', NIR: '🇬🇧',
  GER: '🇩🇪', NED: '🇳🇱', BEL: '🇧🇪', AUT: '🇦🇹', SUI: '🇨🇭',
  IRL: '🇮🇪', IRE: '🇮🇪', POL: '🇵🇱', CZE: '🇨🇿', SRB: '🇷🇸', ESP: '🇪🇸',
  POR: '🇵🇹', FRA: '🇫🇷', ITA: '🇮🇹', DEN: '🇩🇰', SWE: '🇸🇪', NOR: '🇳🇴',
  FIN: '🇫🇮', LAT: '🇱🇻', LTU: '🇱🇹', EST: '🇪🇪', RUS: '🇷🇺', UKR: '🇺🇦',
  AUS: '🇦🇺', NZL: '🇳🇿', USA: '🇺🇸', CAN: '🇨🇦', JPN: '🇯🇵', HKG: '🇭🇰',
  PHI: '🇵🇭', SGP: '🇸🇬', HUN: '🇭🇺',
};

export function flagFor(country: string): string {
  return FLAG_MAP[country?.toUpperCase()] ?? '🏳️';
}

export interface SkinTemplate extends CareerOpponent {
  flag: string;
}

let cachedTemplates: SkinTemplate[] | null = null;

/**
 * Kombiniert PDC_OPPONENTS + PDC_EUROPE_EXTRA, wendet Nicknames an
 * und erzeugt Flag-Emojis. Wird 1× berechnet und gecached.
 */
export function getAllSkinTemplates(): SkinTemplate[] {
  if (cachedTemplates) return cachedTemplates;

  const seenIds = new Set<string>();
  const combined: CareerOpponent[] = [];

  for (const p of PDC_OPPONENTS) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    combined.push({ ...p });
  }
  for (const e of PDC_EUROPE_EXTRA) {
    if (seenIds.has(e.id)) continue;
    seenIds.add(e.id);
    combined.push({ ...e });
  }

  const templates: SkinTemplate[] = combined.map((p) => {
    const meta = NICKNAMES[p.id];
    return {
      ...p,
      nickname: p.nickname ?? meta?.nickname,
      walkOnSong: p.walkOnSong ?? meta?.walkOn,
      flag: flagFor(p.country),
    };
  });

  templates.sort((a, b) => (a.worldRanking || 999) - (b.worldRanking || 999));
  cachedTemplates = templates;
  return templates;
}

export function templateById(id: string): SkinTemplate | undefined {
  return getAllSkinTemplates().find(t => t.id === id);
}

export type SkinFilter = 'all' | 'top16' | 'top32' | 'pdc_europe' | 'german' | 'female' | 'legend';

const EUROPEAN_COUNTRIES = ['GER','NED','BEL','AUT','SUI','POL','CZE','HUN','ESP','POR','ITA','FRA','DEN','SWE','NOR','FIN','SRB','IRL','IRE','LAT','LTU','EST'];
const FEMALE_IDS = ['bgreaves', 'lashton', 'fsherrock'];
const LEGEND_IDS = ['mvg', 'pwright', 'rvbarneveld', 'gprice', 'rcross', 'ganderson', 'msmith'];

export function filterSkinTemplates(list: SkinTemplate[], filter: SkinFilter, search = ''): SkinTemplate[] {
  const s = search.trim().toLowerCase();
  const byName = (t: SkinTemplate) =>
    !s
    || t.name.toLowerCase().includes(s)
    || (t.nickname ?? '').toLowerCase().includes(s)
    || t.country.toLowerCase().includes(s);

  const byFilter = (t: SkinTemplate): boolean => {
    switch (filter) {
      case 'top16': return (t.worldRanking ?? 999) <= 16;
      case 'top32': return (t.worldRanking ?? 999) <= 32;
      case 'pdc_europe': return !!t.isPdcEurope || EUROPEAN_COUNTRIES.includes(t.country);
      case 'german': return t.country === 'GER';
      case 'female': return FEMALE_IDS.includes(t.id);
      case 'legend': return LEGEND_IDS.includes(t.id);
      default: return true;
    }
  };
  return list.filter(t => byFilter(t) && byName(t));
}

/**
 * Zieht die Ziel-PPR für einen Skin auf einer Schwierigkeit
 * (0.4 = Amateur … 1.0 = Elite).
 */
export function pprForSkin(skin: SkinTemplate, difficulty = 0.85): number {
  const mid = (skin.averageMin + skin.averageMax) / 2;
  return Math.round(mid * Math.max(0.3, Math.min(1.1, difficulty)));
}
