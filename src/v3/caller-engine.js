(() => {
  'use strict';

  const core = globalThis.AutodartsToolsV3;
  if (!core || globalThis.AutodartsToolsV3Caller) return;

  const STORAGE_KEY = 'adt:v3:caller';
  const DEFAULTS = Object.freeze({
    enabled: false, mode: 'shadow', language: 'en-US', voiceName: '', rate: 1, pitch: 1, volume: 1,
    dedupeMs: 700, announceDarts: false, announceVisits: true, announceBust: true,
    announceCheckout: true, announceGameShot: true, announceMatchShot: true,
  });
  const state = { received: 0, announced: 0, skipped: 0, duplicates: 0, errors: 0, lastEvent: null, lastText: null, lastAt: 0 };
  let config = load();
  let active = null;
  let voices = [];
  const queue = [];
  const recent = new Map();

  function sanitize(value) {
    const v = value && typeof value === 'object' ? value : {};
    return { ...DEFAULTS, ...v, enabled: Boolean(v.enabled), mode: v.mode === 'live' ? 'live' : 'shadow',
      language: String(v.language || DEFAULTS.language), voiceName: String(v.voiceName || ''),
      rate: Math.max(.5, Math.min(2, Number(v.rate ?? 1))), pitch: Math.max(0, Math.min(2, Number(v.pitch ?? 1))),
      volume: Math.max(0, Math.min(1, Number(v.volume ?? 1))), dedupeMs: Math.max(0, Math.min(5000, Number(v.dedupeMs ?? 700))) };
  }
  function load() { try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { return { ...DEFAULTS }; } }
  function save(next) { config = sanitize(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); return snapshot(); }
  function eventName(d) { return String(d?.event || d?.type || d?.trigger || '').toLowerCase(); }
  function scoreOf(d) { return [d?.score,d?.visitScore,d?.total,d?.value].find(v => Number.isFinite(Number(v))) ?? null; }
  function refreshVoices() { voices = globalThis.speechSynthesis?.getVoices?.() || []; return voices; }
  function selectedVoice() { return voices.find(v => v.name === config.voiceName) || voices.find(v => v.lang === config.language) || voices.find(v => v.lang?.startsWith(config.language.split('-')[0])) || null; }

  const CHECKOUTS = Object.freeze({
    170:'Triple twenty, triple twenty, bull',167:'Triple twenty, triple nineteen, bull',164:'Triple twenty, triple eighteen, bull',
    161:'Triple twenty, triple seventeen, bull',160:'Triple twenty, triple twenty, double twenty',158:'Triple twenty, triple twenty, double nineteen',
    157:'Triple twenty, triple nineteen, double twenty',156:'Triple twenty, triple twenty, double eighteen',155:'Triple twenty, triple nineteen, double nineteen',
    154:'Triple twenty, triple eighteen, double twenty',153:'Triple twenty, triple nineteen, double eighteen',152:'Triple twenty, triple twenty, double sixteen',
    151:'Triple twenty, triple seventeen, double twenty',150:'Triple twenty, triple eighteen, double eighteen',149:'Triple twenty, triple nineteen, double sixteen',
    148:'Triple twenty, triple sixteen, double twenty',147:'Triple twenty, triple seventeen, double eighteen',146:'Triple twenty, triple eighteen, double sixteen',
    145:'Triple twenty, triple fifteen, double twenty',144:'Triple twenty, triple twenty, double twelve',141:'Triple twenty, triple nineteen, double twelve',
    140:'Triple twenty, triple twenty, double ten',138:'Triple twenty, triple eighteen, double twelve',136:'Triple twenty, triple twenty, double eight',
    132:'Bull, bull, double sixteen',130:'Triple twenty, twenty, bull',121:'Triple twenty, eleven, bull',120:'Triple twenty, twenty, double twenty',
    110:'Triple twenty, ten, double twenty',100:'Triple twenty, double twenty',90:'Triple eighteen, double eighteen',80:'Triple twenty, double ten',
    70:'Triple eighteen, double eight',60:'Twenty, double twenty',50:'Bull',40:'Double twenty',32:'Double sixteen',24:'Double twelve',16:'Double eight',8:'Double four',4:'Double two',2:'Double one'
  });

  function checkoutScore(d) { return [d?.remaining,d?.checkout,d?.score,d?.value].find(v => Number.isInteger(Number(v)) && Number(v) >= 2 && Number(v) <= 170) ?? null; }
  function phrase(detail) {
    const name = eventName(detail), score = scoreOf(detail);
    if ((name.includes('match') && name.includes('shot')) || name === 'matchshot') return config.announceMatchShot ? 'Game, shot and the match' : null;
    if ((name.includes('game') && name.includes('shot')) || name === 'gameshot') return config.announceGameShot ? 'Game shot' : null;
    if (name.includes('checkout')) { const c = checkoutScore(detail); if (!config.announceCheckout) return null; return c && CHECKOUTS[c] ? `${c}. ${CHECKOUTS[c]}` : c ? `Checkout ${c}` : 'Checkout'; }
    if (name.includes('bust')) return config.announceBust ? 'No score' : null;
    if (name.includes('visit') || name.includes('turn')) return config.announceVisits && score != null ? String(score) : null;
    if (name.includes('dart') || name.includes('throw')) return config.announceDarts ? String(detail?.segment ?? score ?? '') || null : null;
    return null;
  }

  function duplicate(key) { const now=Date.now(), last=recent.get(key)||0; recent.set(key,now); for (const [k,t] of recent) if (now-t>10000) recent.delete(k); return config.dedupeMs>0 && now-last<config.dedupeMs; }
  function pump() {
    if (active || !queue.length || !globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) return;
    const item=queue.shift(), u=new SpeechSynthesisUtterance(item.text), voice=selectedVoice();
    u.lang=config.language; if (voice) u.voice=voice; u.rate=config.rate; u.pitch=config.pitch; u.volume=config.volume; active=u;
    const done=()=>{active=null;pump();}; u.onend=done; u.onerror=e=>{state.errors++;core.log.warn('Caller speech failed',e?.error||e);done();};
    speechSynthesis.speak(u); state.announced++; state.lastAt=Date.now();
  }
  function announce(text,name='manual') {
    if (!text) return {ok:false,reason:'empty-text'}; const key=`${name}|${text}`;
    if (duplicate(key)) { state.duplicates++; return {ok:true,skipped:'duplicate'}; }
    state.lastEvent=name; state.lastText=text;
    if (config.mode!=='live') { state.skipped++; core.log.debug('Caller shadow announcement',{name,text}); return {ok:true,shadow:true,text}; }
    if (!globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) { state.errors++; return {ok:false,reason:'speech-synthesis-unavailable'}; }
    queue.push({text,name}); pump(); return {ok:true,queued:true,text};
  }
  function onCaller(event) { const d=event?.detail||{}; state.received++; if(!config.enabled){state.skipped++;return;} const text=phrase(d); if(!text){state.skipped++;return;} announce(text,eventName(d)); }
  function snapshot() { return {config:{...config},state:{...state},queueLength:queue.length,speaking:Boolean(active),voices:voices.map(v=>({name:v.name,lang:v.lang,default:v.default}))}; }

  const api=Object.freeze({ snapshot, configure(p={}){return save({...config,...p});}, enable(v=true){return save({...config,enabled:Boolean(v)});},
    setMode(mode){return save({...config,mode});}, setVoice(name){return save({...config,voiceName:name});}, listVoices(){refreshVoices();return snapshot().voices;},
    checkout(score){const n=Number(score);return CHECKOUTS[n]||null;}, preview(text='One hundred and eighty'){return announce(String(text),'preview');},
    stop(){queue.length=0;globalThis.speechSynthesis?.cancel?.();active=null;} });
  Object.defineProperty(globalThis,'AutodartsToolsV3Caller',{value:api,configurable:false,writable:false});
  core.registerModule({id:'feature.caller-v3',start(){refreshVoices();globalThis.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);window.addEventListener('adt:v3:caller',onCaller,{passive:true});},
    stop(){window.removeEventListener('adt:v3:caller',onCaller);globalThis.speechSynthesis?.removeEventListener?.('voiceschanged',refreshVoices);api.stop();},snapshot});
  void core.startModule('feature.caller-v3');
})();
