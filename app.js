/* La compra: lista familiar compartida, con avisos de consumo y control de caducidades. */
(function(){
"use strict";
const DAY = 864e5;
const $ = s => document.querySelector(s);
const VERSION = "1.1.0";
const CAP = window.Capacitor;
const isNative = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const plugin = n => (isNative && CAP.Plugins && CAP.Plugins[n]) || null;

function h(tag, props, ...kids){
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)){
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()){
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
function sing(w){
  if (w.length <= 3 || /ss$/.test(w) || /\d/.test(w)) return w;
  if (w.length > 4 && /[lrndzj]es$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}
const keyOf = s => norm(s).split(" ").map(sing).join(" ");
const cap = s => { s = String(s || "").trim().replace(/\s+/g, " "); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
function pid(key){
  let s = key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  if (!s){ let x = 0; for (const c of key) x = (x * 31 + c.codePointAt(0)) >>> 0; s = "x" + x.toString(36); }
  return "p-" + s;
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reCache = new Map();
function kwMatch(key, kw){
  let re = reCache.get(kw);
  if (!re){ re = new RegExp("(^| )" + esc(kw) + "(s|es)?( |$)"); reCache.set(kw, re); }
  return re.test(key);
}
const randId = (n = 20) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); };

/* ---------- Preferencias de este dispositivo ---------- */
const PREFS_KEY = "lc-prefs";
const prefs = Object.assign({name:"", exp:false, speak:true, noExp:[], household:""}, (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })());
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} };

/* ---------- Pasillos del súper ---------- */
const CATS = [
  {id:"fruta", label:"Fruta y verdura", e:"🥬", kw:"fruta|verdura|manzana|platano|pera|naranja|mandarina|limon|lima|fresa|uva|melon|sandia|pina|kiwi|aguacate|tomate|tomate cherry|lechuga|cebolla|cebolleta|ajo|patata|zanahoria|pimiento|pepino|calabacin|berenjena|espinaca|brocoli|coliflor|champinon|seta|judia verde|judias verdes|puerro|apio|calabaza|cereza|melocoton|nectarina|mango|frambuesa|arandano|perejil|cilantro|albahaca|rucula|canonigo|ensalada|jengibre|boniato|alcachofa|granada|higo|ciruela|maiz dulce"},
  {id:"pan", label:"Panadería", e:"🥖", kw:"pan|barra|barra de pan|baguette|pan de molde|pan integral|chapata|croissant|cruasan|magdalena|bizcocho|biscote|bolleria|napolitana|ensaimada"},
  {id:"carne", label:"Carne y charcutería", e:"🥩", kw:"carne|pollo|pechuga|pechuga de pollo|muslo|alitas|ternera|cerdo|lomo|filete|carne picada|hamburguesa|salchicha|chorizo|jamon|jamon york|jamon serrano|pavo|pechuga de pavo|fiambre|salchichon|fuet|bacon|beicon|panceta|costilla|chuleta|cordero|conejo|morcilla|mortadela|embutido|albondiga|secreto|solomillo"},
  {id:"pescado", label:"Pescado y marisco", e:"🐟", kw:"pescado|merluza|salmon|bacalao|gamba|langostino|calamar|sepia|mejillon|almeja|dorada|lubina|sardina|boqueron|rape|pulpo|marisco|surimi|emperador|atun fresco|trucha"},
  {id:"lacteos", label:"Lácteos y huevos", e:"🥚", kw:"leche|leche entera|leche desnatada|leche semidesnatada|yogur|queso|queso fresco|queso rallado|mantequilla|nata|huevo|kefir|natillas|flan|cuajada|requeson|margarina|batido|bebida de avena|leche de avena|bebida vegetal"},
  {id:"despensa", label:"Despensa", e:"🥫", kw:"arroz|pasta|macarron|espagueti|espaguetis|fideo|tallarines|lenteja|garbanzo|alubia|legumbre|aceite|aceite de oliva|aceite de girasol|vinagre|sal|azucar|harina|tomate frito|tomate triturado|atun|conserva|lata|aceituna|especia|pimienta|oregano|pimenton|caldo|sopa|mayonesa|ketchup|mostaza|salsa|quinoa|cuscus|pan rallado|levadura|frutos secos|almendra|nuez|pipas|patatas fritas|snack|maiz|palomitas|tortillas|tortilla de trigo|pure"},
  {id:"desayuno", label:"Desayuno y dulces", e:"☕", kw:"cafe|te|infusion|manzanilla|cacao|colacao|cola cao|cereales|galleta|mermelada|miel|chocolate|nocilla|crema de cacao|avena|copos de avena|tostadas|turron|caramelos|chicles|gominolas"},
  {id:"bebidas", label:"Bebidas", e:"🧃", kw:"agua|agua con gas|cerveza|vino|refresco|coca cola|cocacola|zumo|tonica|gaseosa|fanta|aquarius|cava|sidra|bebida|nestea|tinto de verano|sin alcohol|bebida isotonica"},
  {id:"congelados", label:"Congelados", e:"🧊", kw:"congelado|congelados|helado|pizza|guisantes|croqueta|empanadilla|hielo|nuggets|varitas|lasana|san jacobo|verdura congelada"},
  {id:"limpieza", label:"Limpieza y hogar", e:"🧽", kw:"detergente|suavizante|lejia|lavavajillas|friegaplatos|fregasuelos|estropajo|bayeta|papel de cocina|rollo de cocina|servilleta|bolsas de basura|bolsa de basura|limpiacristales|amoniaco|ambientador|pastillas lavavajillas|papel de aluminio|papel albal|papel film|film|guantes|quitagrasas|multiusos|pilas|bombilla|velas|insecticida|capsulas lavadora"},
  {id:"higiene", label:"Higiene y farmacia", e:"🧴", kw:"papel higienico|gel|gel de ducha|champu|acondicionador|pasta de dientes|dentifrico|cepillo de dientes|desodorante|compresas|tampones|maquinilla|cuchillas|crema|crema hidratante|colonia|jabon|jabon de manos|toallitas|panales|algodon|bastoncillos|enjuague|colutorio|hilo dental|protector solar|panuelos|tiritas|ibuprofeno|paracetamol|espuma de afeitar|laca|gomina"},
  {id:"mascotas", label:"Mascotas", e:"🐾", kw:"pienso|comida de gato|comida de perro|comida para gato|comida para perro|arena para gato|arena de gato|latas de gato|premios perro"},
  {id:"otros", label:"Otros", e:"🛒", kw:""}
];
CATS.forEach(c => { c.list = c.kw ? [...new Set(c.kw.split("|").map(keyOf))] : []; });
const CAT_BY_ID = Object.fromEntries(CATS.map(c => [c.id, c]));
// Pasillos en los que no se pregunta la caducidad por defecto (no suelen llevar fecha impresa)
const NO_EXP_CATS = new Set(["fruta", "limpieza", "higiene", "mascotas"]);
const catCache = new Map();
function guessCat(key){
  if (catCache.has(key)) return catCache.get(key);
  let best = "otros", score = 0;
  for (const c of CATS) for (const kw of c.list) if (kw.length > score && kwMatch(key, kw)){ best = c.id; score = kw.length; }
  catCache.set(key, best);
  return best;
}

/* ---------- Duración orientativa (días para 2 personas) ---------- */
const BASE = {
  "leche":4, "huevo":9, "pan":2, "pan rallado":60, "barra":2, "barra de pan":2, "pan de molde":6, "pechuga de pavo":6, "jamon york":6, "jamon":8, "fiambre":6,
  "queso":9, "queso fresco":5, "yogur":5, "mantequilla":25, "nata":10, "aceite":30, "aceite de oliva":30, "arroz":25, "pasta":14,
  "macarron":14, "espagueti":14, "tomate frito":12, "tomate":6, "cebolla":12, "patata":12, "ajo":25, "platano":5, "manzana":7,
  "naranja":7, "limon":12, "lechuga":4, "zanahoria":12, "pollo":6, "pechuga de pollo":6, "carne picada":7, "cafe":20, "azucar":60,
  "sal":120, "harina":60, "cereales":12, "galleta":9, "atun":18, "aceituna":14, "mayonesa":30, "agua":6, "cerveza":10, "zumo":5,
  "papel higienico":14, "papel de cocina":14, "servilleta":30, "detergente":35, "suavizante":40, "lavavajillas":30, "fregasuelos":45,
  "gel":30, "champu":40, "pasta de dientes":30, "desodorante":40, "bolsas de basura":30
};
const BASE_KEYS = Object.entries(BASE).map(([k, d]) => [keyOf(k), d]);
function baseDays(key){
  let best = null, len = 0;
  for (const [k, d] of BASE_KEYS) if (k.length > len && kwMatch(key, k)){ best = d; len = k.length; }
  return best;
}

/* ---------- Almacenamiento: Firebase (compartido) o local ---------- */
function makeLocalDb(){
  const KEY = "lc-local-db-v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let data = load();
  const subs = new Set();
  let pending = false;
  const emit = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; subs.forEach(f => f()); }, 0); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { toast("No queda espacio en este dispositivo."); } emit(); };
  window.addEventListener("storage", e => { if (e.key === KEY){ data = load(); emit(); } });
  const meta = {fromCache:false, hasPendingWrites:false};
  const snapDoc = path => ({id:path.split("/").pop(), exists:path in data, data:() => data[path], metadata:meta});
  const clone = o => JSON.parse(JSON.stringify(o));
  function docRef(path){
    return {
      id:path.split("/").pop(), path,
      set:async d => { data[path] = clone(d); save(); },
      update:async d => { if (!(path in data)) throw {code:"not-found"}; data[path] = {...data[path], ...clone(d)}; save(); },
      delete:async () => { delete data[path]; save(); },
      onSnapshot(next){ const f = () => next(snapDoc(path)); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); }
    };
  }
  function query(col, ord, lim){
    return {
      orderBy:(f, dir) => query(col, [f, dir], lim),
      limit:n => query(col, ord, n),
      doc:id => docRef(col + "/" + (id || randId(16))),
      onSnapshot(next){
        const f = () => {
          let docs = Object.keys(data).filter(k => k.slice(0, k.lastIndexOf("/")) === col).map(snapDoc);
          if (ord) docs.sort((a, b) => (ord[1] === "desc" ? -1 : 1) * ((a.data()[ord[0]] || 0) - (b.data()[ord[0]] || 0)));
          if (lim) docs = docs.slice(0, lim);
          next({docs, size:docs.length, empty:!docs.length, metadata:meta});
        };
        subs.add(f); setTimeout(f, 0); return () => subs.delete(f);
      }
    };
  }
  return {collection:p => query(p), doc:p => docRef(p), mode:"local"};
}
function loadScript(src){
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src)); document.head.append(s); });
}
async function makeFirebaseDb(cfg, code){
  const v = "10.12.2", base = isNative ? "./vendor/" : `https://www.gstatic.com/firebasejs/${v}/`;
  await loadScript(base + "firebase-app-compat.js");
  await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-firestore-compat.js")]);
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
  const fs = app.firestore();
  try { await fs.enablePersistence({synchronizeTabs:true}); } catch (e) { /* otra pestaña o navegador sin soporte: sigue online */ }
  const auth = app.auth();
  if (!auth.currentUser){
    await new Promise((res, rej) => {
      const off = auth.onAuthStateChanged(u => { if (u){ off(); res(); } });
      auth.signInAnonymously().catch(e => { off(); rej(e); });
    });
  }
  const home = fs.collection("casas").doc(code);
  return {
    collection:p => home.collection(p),
    doc:p => { const [c, d] = p.split("/"); return home.collection(c).doc(d); },
    mode:"firebase"
  };
}

/* ---------- Estado ---------- */
const S = {
  db:null, mode:"local", setup:null,
  items:[], itemsLoaded:false, products:{}, config:{}, configLoaded:false, trips:[], stock:[], stockLoaded:false,
  loadFail:false, stale:false, err:null, view:"lista", showHidden:false, busy:false, alertShown:false
};
const people = () => Math.max(1, Number(S.config.people) || 2);
const peopleKnown = () => Number(S.config.people) > 0;

/* ---------- Fechas ---------- */
function startOfDay(t){ const x = new Date(t); x.setHours(0,0,0,0); return x.getTime(); }
const isoToTime = iso => { const [y, m, d] = String(iso).split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const daysUntil = iso => Math.round((isoToTime(iso) - startOfDay(Date.now())) / DAY);
const MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MES3 = MES.map(m => m.slice(0, 3));
const fmtShort = iso => { const [y, m, d] = iso.split("-"); return `${+d}/${+m}/${y.slice(2)}`; };
const fmtLong = iso => { const t = new Date(isoToTime(iso)); return new Intl.DateTimeFormat("es-ES", {weekday:"long", day:"numeric", month:"long", year:"numeric"}).format(t); };
function expLabel(iso){
  const d = daysUntil(iso);
  if (d < -1) return `Caducó hace ${-d} días`;
  if (d === -1) return "Caducó ayer";
  if (d === 0) return "Caduca hoy";
  if (d === 1) return "Caduca mañana";
  if (d <= 7) return `Caduca en ${d} días`;
  return `Caduca el ${fmtShort(iso)}`;
}
const expLevel = iso => { const d = daysUntil(iso); return d < 0 ? "out" : d <= 2 ? "soon" : ""; };

/* ---------- Estimación de consumo ---------- */
function lastBuy(p){ const b = p.buys || []; return p.last || (b.length ? b[b.length - 1].t : 0); }
function estimate(p){
  const n = people();
  if (Number(p.customDays) > 0) return {days:Number(p.customDays), source:"custom"};
  const buys = (p.buys || []).slice().sort((a, b) => a.t - b.t);
  if (buys.length >= 2){
    const ints = [];
    for (let i = 1; i < buys.length; i++){
      const d = (buys[i].t - buys[i-1].t) / DAY;
      if (d >= 0.5) ints.push(d * (Number(buys[i-1].p) || n));
    }
    if (ints.length){
      const recent = ints.slice(-6);
      let sw = 0, s = 0;
      recent.forEach((v, i) => { const w = i + 1; s += v * w; sw += w; });
      return {days:Math.max(1, s / sw / n), source:"history"};
    }
  }
  const base = baseDays(p.key || keyOf(p.name));
  if (base) return {days:Math.max(1, base * 2 / n), source:"default"};
  return null;
}
function statusOf(p){
  const last = lastBuy(p), est = estimate(p);
  if (!last || !est) return null;
  const elapsed = (Date.now() - last) / DAY, ratio = elapsed / est.days;
  return {days:est.days, source:est.source, elapsed, ratio, left:est.days - elapsed, level:ratio >= 1 ? "out" : ratio >= 0.75 ? "low" : "ok"};
}
function ago(t){
  const d = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 14) return `hace ${d} días`;
  if (d < 60) return `hace ${Math.round(d / 7)} semanas`;
  return `hace ${Math.round(d / 30)} meses`;
}
const daysTxt = n => { n = Math.max(1, Math.round(n)); return n === 1 ? "1 día" : n + " días"; };
const peopleTxt = n => n === 1 ? "1 persona" : n + " personas";
function stateLabel(st){
  if (!st) return "Sin datos aún";
  if (st.level === "out") return "Seguramente se ha acabado";
  if (st.left < 1.5) return "Se acaba ya";
  return `Quedan unos ${daysTxt(st.left)}`;
}
function reasonLine(p, st){
  const s = `Lo comprasteis ${ago(lastBuy(p))}`;
  if (!st) return s + ".";
  if (st.source === "history") return s + ` y os suele durar unos ${daysTxt(st.days)}.`;
  if (st.source === "custom") return s + ` y habéis indicado que dura unos ${daysTxt(st.days)}.`;
  return s + ` y para ${peopleTxt(people())} suele durar unos ${daysTxt(st.days)}.`;
}
const listKeys = () => new Set(S.items.map(i => i.key));
const productList = () => Object.entries(S.products).map(([id, p]) => ({id, ...p}));
function suggestions(){
  const onList = listKeys(), now = Date.now();
  return productList()
    .filter(p => !p.hidden && !onList.has(p.key) && !(p.snoozeUntil > now))
    .map(p => ({p, st:statusOf(p)}))
    .filter(x => x.st && x.st.ratio >= 0.8 && ((x.p.buys || []).length >= 2 || x.st.source !== "history"))
    .sort((a, b) => b.st.ratio - a.st.ratio);
}
function reviewCandidates(){
  const onList = listKeys(), now = Date.now();
  return productList()
    .filter(p => !p.hidden && !onList.has(p.key) && !(p.snoozeUntil > now))
    .map(p => ({p, st:statusOf(p)}))
    .filter(x => (x.p.buys || []).length >= 2 || x.st)
    .sort((a, b) => (b.st ? b.st.ratio : -1) - (a.st ? a.st.ratio : -1));
}
function catOf(key){
  const p = S.products[pid(key)];
  return (p && p.cat && CAT_BY_ID[p.cat]) ? p.cat : guessCat(key);
}
const wantsExp = it => prefs.exp && !prefs.noExp.includes(it.key) && !NO_EXP_CATS.has(it.cat || catOf(it.key));

/* ---------- Escrituras (optimistas: la pantalla se actualiza al instante, aunque no haya cobertura) ---------- */
function onWriteErr(e){
  const code = e && e.code;
  if (code === "permission-denied") toast("Sin permiso para guardar. Revisa las reglas de Firestore (mira el README).");
  else if (code === "resource-exhausted") toast("Se ha superado el límite gratuito de Firebase por hoy.");
  else toast("No se ha podido guardar un cambio. Revisa la conexión.");
  console.error(e);
}
function w(fn){
  if (!S.db) return false;
  try { const p = fn(); if (p && p.catch) p.catch(onWriteErr); return true; }
  catch (e){ onWriteErr(e); return false; }
}
const col = n => S.db.collection(n);

function parseEntry(raw){
  let s = raw.trim(), qty = "";
  const units = "(?:kg|kilos?|g|gr|gramos|l|litros?|ml|ud|uds|unidades|paquetes?|packs?|botes?|bolsas?|latas?|docenas?|barras?|botellas?|cajas?|bricks?|tarros?)";
  let m = s.match(new RegExp("^(\\d+(?:[.,]\\d+)?\\s*" + units + "?|media docena|una docena|medio kilo|un kilo)\\s+(?:de\\s+)?(.+)$", "i"));
  if (m){ qty = m[1].trim(); s = m[2]; }
  else {
    m = s.match(new RegExp("^(.+?)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?\\s*" + units + "?)$", "i"));
    if (m){ s = m[1]; qty = m[2].trim(); }
  }
  return {name:cap(s), qty};
}
function addEntries(raw){
  const parts = String(raw || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  let added = 0;
  for (const part of parts){
    const {name, qty} = parseEntry(part);
    const key = keyOf(name);
    if (!key) continue;
    const dup = S.items.find(i => i.key === key && !i.checked);
    if (dup){ toast(`${dup.name} ya está en la lista`); continue; }
    const prod = S.products[pid(key)];
    const ref = col("items").doc();
    if (w(() => ref.set({name:prod ? prod.name : name, key, qty, note:"", cat:catOf(key), urgent:false,
      checked:false, exp:"", who:prefs.name || "", addedAt:Date.now()}))) added++;
  }
  return added;
}
function setChecked(it, checked){
  w(() => col("items").doc(it.id).update({checked, checkedAt:checked ? Date.now() : 0, checkedBy:checked ? (prefs.name || "") : "", ...(checked ? {} : {exp:""})}));
}
function removeItem(it){
  const {id, ...data} = it;
  if (w(() => col("items").doc(id).delete())) toast(`${it.name} quitado de la lista`, "Deshacer", () => w(() => col("items").doc(id).set(data)));
}
function snooze(p, st){
  let d = 2;
  if (st) d = st.left > 0 ? Math.min(14, Math.max(2, st.left * 0.6)) : Math.min(10, Math.max(2, st.days * 0.3));
  w(() => col("products").doc(p.id).update({snoozeUntil:Date.now() + d * DAY}));
}
function checkout(){
  if (S.busy) return;
  const done = S.items.filter(i => i.checked);
  if (!done.length) return;
  closeSheet();
  const now = Date.now(), n = people();
  const byKey = new Map();
  for (const i of done) if (!byKey.has(i.key)) byKey.set(i.key, i);
  for (const [key, i] of byKey){
    const id = pid(key), ex = S.products[id];
    const buys = [...((ex && ex.buys) || []), {t:now, p:n}].slice(-20);
    w(() => col("products").doc(id).set({
      name:ex ? ex.name : i.name, key, cat:i.cat || (ex && ex.cat) || guessCat(key), buys,
      total:((ex && ex.total) || 0) + 1, last:now, snoozeUntil:0, hidden:false, customDays:(ex && ex.customDays) || 0
    }));
  }
  let dated = 0;
  for (const i of done){
    if (i.exp){ dated++; w(() => col("stock").doc().set({name:i.name, key:i.key, qty:i.qty || "", cat:i.cat || "", exp:i.exp, at:now, who:i.checkedBy || prefs.name || ""})); }
    w(() => col("items").doc(i.id).delete());
  }
  w(() => col("trips").doc().set({t:now, by:prefs.name || "", n:done.length, names:done.map(i => i.name).slice(0, 200)}));
  toast(`Compra guardada: ${done.length} ${done.length === 1 ? "producto" : "productos"}` + (dated ? `, ${dated} con fecha de caducidad.` : "."));
}

/* ---------- Voz ---------- */
const SR = isNative ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
const NSR = plugin("SpeechRecognition");
const NTTS = plugin("TextToSpeech");
const canListen = !!(SR || NSR);
// En la app Android: reconocimiento de voz nativo de Android
function listenNative({onFinal, onEnd}){
  let stopped = false;
  const end = (err, fin) => { if (onEnd){ const f = onEnd; onEnd = null; f(err, fin); } };
  const handle = {abort(){ stopped = true; NSR.stop().catch(() => {}); end(null, false); }, stop(){ NSR.stop().catch(() => {}); }};
  (async () => {
    try {
      let perm = await NSR.checkPermissions();
      if (perm.speechRecognition !== "granted") perm = await NSR.requestPermissions();
      if (perm.speechRecognition !== "granted"){ end("not-allowed", false); return; }
      const r = await NSR.start({language:"es-ES", maxResults:5, partialResults:false, popup:false});
      if (stopped) return;
      const m = (r && r.matches) || [];
      if (m.length){ onFinal && onFinal(m); end(null, true); } else end(null, false);
    } catch (e){ if (!stopped) end("no-speech", false); }
  })();
  return handle;
}
function listen({onPartial, onFinal, onEnd}){
  if (NSR) return listenNative({onFinal, onEnd});
  if (!SR) return null;
  let r;
  try { r = new SR(); } catch { return null; }
  r.lang = "es-ES"; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
  let finished = false;
  r.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++){
      const res = e.results[i];
      const alts = [...res].map(a => a.transcript);
      if (res.isFinal){ finished = true; onFinal && onFinal(alts); }
      else onPartial && onPartial(alts[0]);
    }
  };
  r.onerror = e => { onEnd && onEnd(e.error || "error", finished); onEnd = null; };
  r.onend = () => { onEnd && onEnd(null, finished); onEnd = null; };
  try { r.start(); } catch { return null; }
  return r;
}
function say(text){
  if (!prefs.speak) return;
  if (NTTS){ NTTS.speak({text, lang:"es-ES", rate:1.0}).catch(() => {}); return; }
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES"; u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {}
}
const spokenDate = iso => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MES[m - 1]} de ${y}`; };

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg, actLabel, act){
  $("#toastMsg").textContent = msg;
  const b = $("#toastAct");
  if (actLabel){ b.hidden = false; b.textContent = actLabel; b.onclick = () => { $("#toast").hidden = true; act(); }; }
  else { b.hidden = true; b.onclick = null; }
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, actLabel ? 6000 : 3500);
}

/* ---------- Hoja inferior ---------- */
let lastFocus = null, onSheetClose = null;
function openSheet(build, opts = {}){
  if (onSheetClose){ const f = onSheetClose; onSheetClose = null; f(); }
  lastFocus = document.activeElement;
  const sh = $("#sheet");
  sh.replaceChildren(...[].concat(build()).flat(Infinity).filter(x => x != null && x !== false));
  $("#sheetWrap").hidden = false;
  document.body.classList.add("sheet-open");
  onSheetClose = opts.onClose || null;
  if (opts.focus !== false){
    const f = sh.querySelector(".autofocus") || sh.querySelector("input,select,button");
    if (f) setTimeout(() => f.focus({preventScroll:true}), 30);
  }
}
function closeSheet(){
  if (onSheetClose){ const f = onSheetClose; onSheetClose = null; f(); }
  $("#sheetWrap").hidden = true;
  document.body.classList.remove("sheet-open");
  $("#sheet").replaceChildren();
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({preventScroll:true});
}
$("#sheetWrap").addEventListener("click", e => { if (e.target === e.currentTarget) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheetWrap").hidden) closeSheet(); });

function catSelect(value){
  return h("select", {id:"fCat"}, CATS.map(c => h("option", {value:c.id, selected:c.id === value}, `${c.e} ${c.label}`)));
}
const isoInput = (id, value) => h("input", {id, type:"date", value:value || ""});

/* ---------- Caducidad por voz ---------- */
// mode: "item" (al meterlo en el carro), "stock" (producto ya en casa), "new" (añadir a mano en la despensa)
function openExpiry({mode, item, stock, autoListen}){
  let rec = null, chosen = null;
  const nameOf = () => (item && item.name) || (stock && stock.name) || "";
  const heard = h("span", {class:"heard", text: canListen ? "Toca el micro y di la fecha, por ejemplo «20 11 26»." : "Escribe la fecha, por ejemplo 20 11 26."});
  const box = h("div", {class:"listen"}, h("span", {class:"dot", "aria-hidden":"true"}), heard);
  const result = h("div", {class:"big-date", "aria-live":"polite"});
  const typed = h("input", {id:"fTyped", inputmode:"numeric", autocomplete:"off", placeholder:"20 11 26"});
  const picker = isoInput("fDate", (item && item.exp) || (stock && stock.exp) || "");
  const nameIn = mode === "new" ? h("input", {id:"fNewName", placeholder:"Yogures, pechuga de pavo…", class:"autofocus"}) : null;
  const saveBtn = h("button", {class:"btn btn-primary", type:"button", disabled:true, onclick:() => commit()}, "Guardar fecha");
  const micBtn = canListen ? h("button", {class:"btn btn-ghost", type:"button", onclick:() => start()}, "🎤 Decir la fecha") : null;

  function show(iso, approx){
    chosen = iso;
    result.replaceChildren(fmtShort(iso), h("small", {text:(approx ? "Fin de mes. " : "") + cap(fmtLong(iso)) + ". " + expLabel(iso) + "."}));
    picker.value = iso;
    saveBtn.disabled = false;
  }
  function tryParse(alts){
    for (const a of [].concat(alts)){ const r = DateParse.parse(a); if (r) return r; }
    return null;
  }
  function start(){
    if (!canListen) return;
    if (rec){ try { rec.abort(); } catch {} rec = null; }
    box.classList.add("on");
    heard.textContent = "Te escucho…";
    rec = listen({
      onPartial:t => { heard.textContent = `«${t}»`; },
      onFinal:alts => {
        heard.textContent = `«${alts[0]}»`;
        const r = tryParse(alts);
        if (r){
          show(r.iso, r.approx);
          if (mode !== "new") setTimeout(() => commit(true), 350);
        } else heard.textContent = `No he entendido «${alts[0]}». Repite la fecha o escríbela.`;
      },
      onEnd:(err, finished) => {
        box.classList.remove("on"); rec = null;
        if (err === "not-allowed" || err === "service-not-allowed") heard.textContent = "El navegador no deja usar el micrófono. Escribe la fecha abajo.";
        else if (!finished && !chosen) heard.textContent = "No he oído nada. Toca «Decir la fecha» o escríbela.";
      }
    });
    if (!rec){ box.classList.remove("on"); heard.textContent = "El dictado no está disponible en este navegador. Escribe la fecha."; }
  }
  function commit(byVoice){
    if (!chosen) return;
    const iso = chosen, nm = nameOf();
    if (mode === "item") w(() => col("items").doc(item.id).update({exp:iso}));
    else if (mode === "stock") w(() => col("stock").doc(stock.id).update({exp:iso}));
    else {
      const name = cap(nameIn.value);
      if (!name){ nameIn.focus(); toast("Escribe qué producto es."); return; }
      const key = keyOf(name);
      w(() => col("stock").doc().set({name, key, qty:"", cat:catOf(key), exp:iso, at:Date.now(), who:prefs.name || ""}));
    }
    if (byVoice) say(`Caduca el ${spokenDate(iso)}`);
    closeSheet();
    if (mode === "item") toast(`${nm}: ${expLabel(iso).toLowerCase()}`, "Cambiar", () => openExpiry({mode, item:{...item, exp:iso}}));
    else toast("Fecha guardada");
  }
  typed.addEventListener("input", () => {
    const r = typed.value.trim() ? DateParse.parse(typed.value) : null;
    if (r) show(r.iso, r.approx); else if (!typed.value.trim()) { /* nada */ } else { result.textContent = ""; saveBtn.disabled = true; chosen = null; }
  });
  typed.addEventListener("keydown", e => { if (e.key === "Enter" && chosen){ e.preventDefault(); commit(); } });
  picker.addEventListener("change", () => { if (picker.value) show(picker.value, false); });

  openSheet(() => [
    h("h2", {id:"sheetTitle", text: mode === "new" ? "Añadir con fecha" : `¿Cuándo caduca ${nameOf().toLowerCase()}?`}),
    mode === "item" ? h("p", {class:"sub", text:"Ya está en el carro. Di la fecha del envase y se guarda sola."}) : null,
    nameIn ? h("label", {class:"field"}, h("span", {text:"Producto"}), nameIn) : null,
    box, result,
    h("label", {class:"field"}, h("span", {text:"O escríbela (día, mes y año)"}), typed),
    h("label", {class:"field"}, h("span", {text:"O elígela en el calendario"}), picker),
    h("div", {class:"stack"},
      saveBtn, micBtn,
      mode === "item" ? h("button", {class:"btn btn-ghost", type:"button", onclick:closeSheet}, "Sin fecha") : null,
      mode === "item" ? h("button", {class:"link-btn", type:"button", onclick:() => {
        if (!prefs.noExp.includes(item.key)) prefs.noExp.push(item.key);
        savePrefs(); closeSheet(); toast(`No volveré a preguntar la fecha de ${item.name.toLowerCase()}`);
      }}, "No preguntar más por este producto") : h("button", {class:"btn btn-ghost", type:"button", onclick:closeSheet}, "Cancelar"))
  ], {focus:!autoListen, onClose:() => { if (rec){ try { rec.abort(); } catch {} rec = null; } }});
  if (item && item.exp) show(item.exp, false);
  if (stock && stock.exp) show(stock.exp, false);
  if (autoListen) start();
}

/* ---------- Hojas ---------- */
function openItem(it){
  openSheet(() => {
    const name = h("input", {id:"fName", value:it.name, maxlength:"80"});
    const qty = h("input", {id:"fQty", value:it.qty || "", placeholder:"Ej.: 2, 1 kg, 6 latas", maxlength:"30"});
    const note = h("input", {id:"fNote", value:it.note || "", placeholder:"Marca, tamaño, el de la oferta…", maxlength:"120"});
    const cat = catSelect(it.cat || catOf(it.key));
    const urgent = h("input", {type:"checkbox", id:"fUrg", checked:!!it.urgent});
    const showExp = it.checked && (prefs.exp || it.exp);
    const exp = showExp ? isoInput("fExp", it.exp) : null;
    const save = () => {
      const nn = cap(name.value) || it.name, key = keyOf(nn) || it.key;
      const patch = {name:nn, key, qty:qty.value.trim(), note:note.value.trim(), cat:cat.value, urgent:urgent.checked};
      if (exp) patch.exp = exp.value || "";
      closeSheet();
      w(() => col("items").doc(it.id).update(patch));
      const p = S.products[pid(key)];
      if (p && p.cat !== cat.value) w(() => col("products").doc(pid(key)).update({cat:cat.value}));
    };
    return [
      h("h2", {id:"sheetTitle", text:it.name}),
      it.who ? h("p", {class:"sub", text:`Lo apuntó ${it.who}.`}) : null,
      h("label", {class:"field"}, h("span", {text:"Producto"}), name),
      h("label", {class:"field"}, h("span", {text:"Cantidad"}), qty),
      h("label", {class:"field"}, h("span", {text:"Nota"}), note),
      h("label", {class:"field"}, h("span", {text:"Pasillo"}), cat),
      exp ? h("label", {class:"field"}, h("span", {text:"Fecha de caducidad"}), exp) : null,
      h("label", {class:"check"}, urgent, "Lo necesitamos hoy"),
      h("div", {class:"row"},
        h("button", {class:"btn btn-danger", type:"button", onclick:() => { closeSheet(); removeItem(it); }}, "Quitar"),
        h("button", {class:"btn btn-primary", type:"button", onclick:save}, "Guardar"))
    ];
  });
}

function shareLink(){
  const web = (window.APP_CONFIG && window.APP_CONFIG.webUrl) || "";
  if (isNative){
    if (!web) return "";
    const u = new URL(web); u.search = "?casa=" + prefs.household; u.hash = ""; return u.toString();
  }
  const u = new URL(location.href);
  u.hash = ""; u.search = "?casa=" + prefs.household;
  return u.toString();
}
async function invite(){
  const url = shareLink();
  const text = url ? `Únete a nuestra lista de la compra: ${url}` : `Únete a nuestra lista de la compra. Código de casa: ${prefs.household}`;
  const NS = plugin("Share");
  if (NS){ try { await NS.share({title:"La lista de la compra", text, url:url || undefined, dialogTitle:"Invitar a la familia"}); } catch {} return; }
  if (navigator.share){ try { await navigator.share({title:"La lista de la compra", text:"Únete a nuestra lista de la compra", url}); return; } catch (e){ if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url); toast("Enlace copiado. Pégalo en el grupo de la familia."); }
  catch { prompt("Copia esto y mándalo a tu familia:", text); }
}

function openSettings(){
  let n = people();
  openSheet(() => {
    const out = h("output", {id:"pOut", "aria-live":"polite", text:String(n)});
    const homeName = h("input", {id:"fHome", value:S.config.name || "", placeholder:"La compra", maxlength:"40"});
    const myName = h("input", {id:"fMe", value:prefs.name, placeholder:"Tu nombre", maxlength:"30", autocomplete:"given-name"});
    const set = d => { n = Math.min(15, Math.max(1, n + d)); out.textContent = n; };
    const expSw = h("input", {type:"checkbox", class:"switch", id:"swExp", checked:prefs.exp, "aria-describedby":"swExpD"});
    const spkSw = h("input", {type:"checkbox", class:"switch", id:"swSpk", checked:prefs.speak});
    return [
      h("h2", {id:"sheetTitle", text:"Ajustes"}),
      h("p", {class:"sub", text:"¿Cuántos sois en casa? Sirve para calcular cuánto os dura cada cosa."}),
      h("div", {class:"stepper"},
        h("button", {type:"button", "aria-label":"Una persona menos", onclick:() => set(-1)}, "−"),
        out,
        h("button", {type:"button", "aria-label":"Una persona más", onclick:() => set(1)}, "+")),
      h("label", {class:"field"}, h("span", {text:"Nombre de la lista"}), homeName),
      h("label", {class:"field"}, h("span", {text:"Tu nombre (para saber quién apunta cada cosa)"}), myName),
      h("label", {class:"toggle", for:"swExp"},
        h("span", {class:"tx"}, h("b", {text:"Controlar fechas de caducidad"}),
          h("span", {id:"swExpD", text:"Al meter algo en el carro te pide la fecha (por voz o escrita) y la despensa se ordena por caducidad. Solo en este móvil."})),
        expSw),
      h("label", {class:"toggle", for:"swSpk"},
        h("span", {class:"tx"}, h("b", {text:"Repetir la fecha en voz alta"}), h("span", {text:"Para confirmar sin mirar la pantalla."})),
        spkSw),
      prefs.noExp.length ? h("button", {class:"link-btn", type:"button", onclick:e => { prefs.noExp = []; savePrefs(); e.currentTarget.remove(); toast("Volveré a preguntar por todos los productos"); }},
        `Volver a preguntar la fecha de ${prefs.noExp.length} ${prefs.noExp.length === 1 ? "producto" : "productos"}`) : null,
      h("div", {class:"stack"},
        h("button", {class:"btn btn-primary", type:"button", onclick:() => {
          prefs.name = myName.value.trim().slice(0, 30);
          prefs.exp = expSw.checked; prefs.speak = spkSw.checked;
          savePrefs();
          const name = homeName.value.trim().slice(0, 40);
          closeSheet();
          w(() => S.db.doc("config/home").set({...S.config, people:n, name}));
          render();
        }}, "Guardar"),
        S.mode === "firebase" ? h("button", {class:"btn btn-ink", type:"button", onclick:invite}, "Invitar a la familia") : null),
      S.mode === "firebase"
        ? h("div", {class:"help"}, "Todo el que abra el enlace de invitación verá y editará esta misma lista. ",
            h("button", {class:"link-btn", type:"button", onclick:() => {
              if (!confirm("¿Salir de esta lista en este móvil? La lista no se borra; podrás volver con el enlace de invitación.")) return;
              prefs.household = ""; savePrefs(); location.href = location.pathname;
            }}, "Salir de esta lista"))
        : h("div", {class:"help"}, h("b", {text:"Modo local. "}), "La lista solo se guarda en este dispositivo. Para compartirla con tu familia, configura Firebase siguiendo el README del proyecto."),
      h("p", {class:"mode-note", text:`Versión ${VERSION}`})
    ];
  });
}

function openProduct(p){
  const st = statusOf(p);
  const onList = listKeys().has(p.key);
  openSheet(() => {
    const est = st ? Math.round(st.days) : "";
    const custom = h("input", {id:"fDays", type:"number", min:"1", max:"365", inputmode:"numeric", value:p.customDays ? String(p.customDays) : "", placeholder:est ? `Automático: unos ${est}` : "Automático"});
    const cat = catSelect(p.cat || guessCat(p.key));
    const times = p.total || (p.buys || []).length;
    return [
      h("h2", {id:"sheetTitle", text:p.name}),
      h("p", {class:"sub", text:`${stateLabel(st)}. ${reasonLine(p, st)} Comprado ${times} ${times === 1 ? "vez" : "veces"}.`}),
      h("label", {class:"field"}, h("span", {text:"¿Cuántos días os dura? Déjalo vacío para que lo calcule solo"}), custom),
      h("label", {class:"field"}, h("span", {text:"Pasillo"}), cat),
      h("div", {class:"stack"},
        onList ? null : h("button", {class:"btn btn-ink", type:"button", onclick:() => { closeSheet(); if (addEntries(p.name)) toast(`${p.name} apuntado`); }}, "Apuntar en la lista"),
        h("button", {class:"btn btn-primary", type:"button", onclick:() => {
          const v = Math.round(Number(custom.value));
          closeSheet();
          w(() => col("products").doc(p.id).update({customDays:v > 0 ? Math.min(365, v) : 0, cat:cat.value}));
        }}, "Guardar cambios"),
        h("button", {class:"btn btn-ghost", type:"button", onclick:() => {
          closeSheet();
          w(() => col("products").doc(p.id).update({hidden:!p.hidden}));
          toast(p.hidden ? `${p.name} vuelve a las sugerencias` : `No volveré a sugerir ${p.name}`);
        }}, p.hidden ? "Volver a sugerirlo" : "Ya no lo compramos"),
        h("button", {class:"btn btn-danger", type:"button", onclick:() => {
          const {id, ...data} = p;
          closeSheet();
          if (w(() => col("products").doc(id).delete())) toast(`${p.name} borrado del historial`, "Deshacer", () => w(() => col("products").doc(id).set(data)));
        }}, "Borrar del historial"))
    ];
  });
}

function removeStock(s, how){
  const {id, ...data} = s;
  if (w(() => col("stock").doc(id).delete()))
    toast(how === "tirado" ? `${s.name}: anotado como tirado` : `${s.name} gastado`, "Deshacer", () => w(() => col("stock").doc(id).set(data)));
}
function openStock(s){
  openSheet(() => [
    h("h2", {id:"sheetTitle", text:s.name}),
    h("p", {class:"sub", text:`${expLabel(s.exp)}. ${cap(fmtLong(s.exp))}.` + (s.at ? ` Comprado ${ago(s.at)}${s.who ? " por " + s.who : ""}.` : "")}),
    h("div", {class:"stack"},
      h("button", {class:"btn btn-ink", type:"button", onclick:() => { closeSheet(); removeStock(s, "gastado"); }}, "Ya lo hemos gastado"),
      h("button", {class:"btn btn-ghost", type:"button", onclick:() => openExpiry({mode:"stock", stock:s})}, "Cambiar la fecha"),
      listKeys().has(s.key) ? null : h("button", {class:"btn btn-ghost", type:"button", onclick:() => { closeSheet(); if (addEntries(s.name)) toast(`${s.name} apuntado`); }}, "Apuntar para comprar"),
      h("button", {class:"btn btn-danger", type:"button", onclick:() => { closeSheet(); removeStock(s, "tirado"); }}, "Se ha tirado"))
  ]);
}

function openReview(){
  const list = reviewCandidates();
  let idx = 0, added = 0;
  const draw = () => {
    const sh = $("#sheet");
    if (idx >= list.length){
      sh.replaceChildren(
        h("h2", {id:"sheetTitle", text:"Repaso terminado"}),
        h("p", {class:"sub", text:added ? `Has apuntado ${added} ${added === 1 ? "producto" : "productos"} en la lista.` : "No has apuntado nada nuevo. La despensa va bien."}),
        h("div", {class:"stack"}, h("button", {class:"btn btn-primary", type:"button", onclick:closeSheet}, "Volver a la lista")));
      sh.querySelector("button").focus();
      return;
    }
    const {p, st} = list[idx];
    const next = () => { idx++; draw(); };
    sh.replaceChildren(
      h("div", {class:"progress"}, `${idx + 1} de ${list.length}`,
        h("div", {class:"progress-bar"}, h("span", {style:`width:${(idx / list.length) * 100}%`}))),
      h("h2", {id:"sheetTitle", class:"sr", text:"Repaso de despensa"}),
      h("div", {class:"review-name", text:`¿Os falta ${p.name.toLowerCase()}?`}),
      h("p", {class:"sub", text:reasonLine(p, st)}),
      st ? gauge(st) : null,
      h("div", {class:"stack"},
        h("button", {class:"btn btn-ink", type:"button", onclick:() => { if (addEntries(p.name)) added++; next(); }}, "Sí, apuntar"),
        h("button", {class:"btn btn-ghost", type:"button", onclick:() => { next(); snooze(p, st); }}, "No, aún queda"),
        h("button", {class:"btn btn-ghost", type:"button", onclick:next}, "Saltar"),
        h("button", {class:"link-btn", type:"button", onclick:closeSheet}, "Terminar el repaso")));
    sh.querySelector(".btn").focus({preventScroll:true});
  };
  if (!list.length){
    openSheet(() => [h("h2", {id:"sheetTitle", text:"Nada que repasar todavía"}),
      h("p", {class:"sub", text:"Cuando hayáis comprado algo al menos dos veces, aparecerá aquí para comprobar si os falta."}),
      h("div", {class:"stack"}, h("button", {class:"btn btn-primary", type:"button", onclick:closeSheet}, "Entendido"))]);
    return;
  }
  openSheet(() => [h("span")]);
  draw();
}

function openCheckout(){
  const doneItems = S.items.filter(i => i.checked);
  const done = doneItems.length, left = S.items.length - done;
  const dated = doneItems.filter(i => i.exp).length;
  openSheet(() => [
    h("h2", {id:"sheetTitle", text:"¿Terminar la compra?"}),
    h("p", {class:"sub", text:`Los ${done} productos del carro se guardan en el historial y salen de la lista.` +
      (dated ? ` Los ${dated} con fecha pasan a la despensa para avisarte antes de que caduquen.` : "") +
      (left ? ` Lo que no habéis cogido (${left}) se queda apuntado para la próxima.` : "")}),
    h("div", {class:"row"},
      h("button", {class:"btn btn-ghost", type:"button", onclick:closeSheet}, "Seguir comprando"),
      h("button", {class:"btn btn-primary", type:"button", onclick:checkout}, "Terminar compra"))
  ]);
}

/* Aviso al abrir: lo que caduca hoy (y lo caducado o lo de mañana) */
function maybeExpiryAlert(){
  if (S.alertShown || !prefs.exp || !S.stockLoaded || S.setup) return;
  if (!$("#sheetWrap").hidden) return;
  const urgent = S.stock.filter(s => s.exp && daysUntil(s.exp) <= 1).sort((a, b) => a.exp.localeCompare(b.exp));
  S.alertShown = true;
  if (!urgent.length) return;
  const today = urgent.filter(s => daysUntil(s.exp) === 0);
  const past = urgent.filter(s => daysUntil(s.exp) < 0);
  const tomorrow = urgent.filter(s => daysUntil(s.exp) === 1);
  const rows = (arr) => h("ul", {class:"alert-list"}, arr.map(s => h("li", null,
    h("span", {class:"an"}, h("b", {text:s.name}), h("span", {text:expLabel(s.exp)})),
    h("button", {class:"chip-btn chip-no", type:"button", onclick:e => { removeStock(s, "tirado"); e.currentTarget.closest("li").remove(); }}, "Tirado"),
    h("button", {class:"chip-btn chip-yes", type:"button", onclick:e => { removeStock(s, "gastado"); e.currentTarget.closest("li").remove(); }}, "Gastado"))));
  const title = today.length
    ? (today.length === 1 ? `Hoy caduca ${today[0].name.toLowerCase()}` : `Hoy caducan ${today.length} productos`)
    : past.length ? "Hay productos caducados" : "Mañana caduca algo";
  openSheet(() => [
    h("h2", {id:"sheetTitle", text:title}),
    h("p", {class:"sub", text:"Úsalos hoy o márcalos cuando ya no estén en casa."}),
    today.length ? [h("p", {class:"alert-head", text:"Caduca hoy"}), rows(today)] : null,
    past.length ? [h("p", {class:"alert-head out", text:"Ya caducados"}), rows(past)] : null,
    tomorrow.length ? [h("p", {class:"alert-head", text:"Caduca mañana"}), rows(tomorrow)] : null,
    h("div", {class:"stack"}, h("button", {class:"btn btn-primary autofocus", type:"button", onclick:closeSheet}, "Entendido"))
  ]);
  if (navigator.vibrate) try { navigator.vibrate(120); } catch {}
}

/* ---------- Render ---------- */
function gauge(st){
  const pct = Math.max(st.level === "out" ? 4 : 6, Math.min(100, (1 - st.ratio) * 100));
  return h("div", {class:`gauge lvl-${st.level}`, role:"img", "aria-label":stateLabel(st)}, h("span", {style:`width:${pct}%`}));
}
const AV_COLORS = ["#C2185B", "#00838F", "#6A1B9A", "#2E7D32", "#EF6C00", "#1565C0", "#AD1457", "#4E342E"];
function avatar(name, label){
  if (!name) return h("span", {class:"av", style:"visibility:hidden", "aria-hidden":"true"});
  let x = 0; for (const c of name) x = (x * 31 + c.codePointAt(0)) >>> 0;
  return h("span", {class:"av", style:`background:${AV_COLORS[x % AV_COLORS.length]}`, title:`${label} ${name}`, "aria-label":`${label} ${name}`, role:"img"}, name.trim().charAt(0).toUpperCase());
}
function svgCheck(){
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "3.2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path"); p.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5"); s.append(p);
  return s;
}
function onTick(it){
  const checking = !it.checked;
  setChecked(it, checking);
  if (checking && wantsExp(it)) openExpiry({mode:"item", item:it, autoListen:true}); // dentro del mismo toque: el navegador permite el micro
}
function itemRow(it){
  return h("li", {class:"item" + (it.checked ? " is-checked" : "") + (it.urgent && !it.checked ? " is-urgent" : "")},
    h("button", {class:"tick", type:"button", "aria-pressed":String(!!it.checked),
      "aria-label":(it.checked ? "Devolver a la lista: " : "Marcar como cogido: ") + it.name, onclick:() => onTick(it)},
      h("span", {class:"circ"}, svgCheck())),
    h("button", {class:"item-body", type:"button", onclick:() => openItem(it), "aria-label":`Editar ${it.name}`},
      h("span", {class:"item-name", text:it.name}),
      it.qty ? h("span", {class:"qty", text:it.qty}) : null,
      it.urgent && !it.checked ? h("span", {class:"badge", text:"Hoy"}) : null,
      it.checked && it.exp ? h("span", {class:`exp-tag ${expLevel(it.exp)}`, text:`Cad. ${fmtShort(it.exp)}`}) : null,
      it.note ? h("span", {class:"item-note", text:it.note}) : null),
    avatar(it.who, "Apuntado por"));
}
function notices(root){
  if (S.err) root.append(h("div", {class:"banner warn"}, h("b", {text:"Problema con la lista compartida"}), S.err));
  if (S.stale) root.append(h("div", {class:"banner"}, "Sin conexión: estás viendo la última versión guardada. Lo que apuntes se enviará al recuperar cobertura."));
}
function renderList(){
  const root = $("#v-lista");
  root.replaceChildren();
  notices(root);
  if (!S.itemsLoaded){
    root.append(h("p", {class:"loading", text:S.loadFail ? "No consigo conectar con la lista. Aparecerá en cuanto vuelva la conexión." : "Cargando la lista…"}));
    return;
  }
  if (S.configLoaded && !peopleKnown()){
    root.append(h("div", {class:"banner"}, h("b", {text:"¿Cuántos sois en casa?"}),
      "Con eso calculo cuánto os dura cada producto y os aviso antes de que se acabe.",
      h("div", {class:"row"}, h("button", {class:"btn btn-primary", type:"button", onclick:openSettings}, "Indicarlo"))));
  }
  const sug = suggestions();
  if (sug.length){
    const card = h("div", {class:"suggest"},
      h("h2", {text:"¿Os falta algo de esto?"}),
      h("p", {class:"sub", text:`Por lo que soléis comprar y siendo ${peopleTxt(people())}, puede que se haya acabado o esté a punto.`}));
    for (const {p, st} of sug.slice(0, 4)){
      card.append(h("div", {class:"sug-row"},
        h("div", {class:"t"}, h("b", {text:p.name}), h("span", {text:stateLabel(st)})),
        h("button", {class:"chip-btn chip-no", type:"button", "aria-label":`Aún queda ${p.name}`, onclick:() => snooze(p, st)}, "Queda"),
        h("button", {class:"chip-btn chip-yes", type:"button", "aria-label":`Apuntar ${p.name}`, onclick:() => addEntries(p.name)}, "Apuntar")));
    }
    card.append(h("button", {class:"review-link", type:"button", onclick:openReview}, sug.length > 4 ? `Repasar la despensa (${sug.length} avisos y más)` : "Repasar toda la despensa"));
    root.append(card);
  } else if (reviewCandidates().length){
    root.append(h("button", {class:"btn btn-ghost review-plain", type:"button", onclick:openReview}, "Repasar la despensa antes de ir al súper"));
  }
  const pending = S.items.filter(i => !i.checked);
  const done = S.items.filter(i => i.checked).sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0));
  if (!S.items.length){
    root.append(h("div", {class:"empty"}, h("b", {text:"La lista está vacía"}),
      S.mode === "firebase" ? "Escribe arriba lo que falta. Puedes poner varias cosas separadas por comas y tu familia lo verá al momento."
        : "Escribe arriba lo que falta. Puedes poner varias cosas separadas por comas."));
  }
  for (const c of CATS){
    const its = pending.filter(i => (CAT_BY_ID[i.cat] ? i.cat : "otros") === c.id)
      .sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || (a.addedAt || 0) - (b.addedAt || 0));
    if (!its.length) continue;
    root.append(h("section", {class:"group"},
      h("h2", null, h("span", {"aria-hidden":"true", text:c.e}), c.label, h("span", {class:"n", text:`(${its.length})`})),
      h("ul", {class:"items"}, its.map(itemRow))));
  }
  if (done.length){
    root.append(h("section", {class:"group"},
      h("h2", null, h("span", {"aria-hidden":"true", text:"🛒"}), "En el carro", h("span", {class:"n", text:`(${done.length})`})),
      h("ul", {class:"items"}, done.map(itemRow))));
  }
}
function renderStock(root){
  const list = S.stock.filter(s => s.exp).slice().sort((a, b) => a.exp.localeCompare(b.exp) || a.name.localeCompare(b.name, "es"));
  root.append(h("div", {class:"sec-head"},
    h("h3", {class:"sec", text:"Por fecha de caducidad"}),
    h("button", {class:"link-btn", type:"button", onclick:() => openExpiry({mode:"new"})}, "+ Añadir con fecha")));
  if (!list.length){
    root.append(h("div", {class:"banner"}, "Aún no hay fechas. Al meter algo en el carro te pediré la fecha del envase; también puedes añadir lo que ya tienes en casa."));
    return;
  }
  root.append(h("ul", {class:"stock"}, list.map(s => {
    const [, m, d] = s.exp.split("-").map(Number);
    const lvl = expLevel(s.exp);
    return h("li", null, h("button", {class:"srow", type:"button", onclick:() => openStock(s)},
      h("span", {class:`date ${lvl}`, "aria-hidden":"true"}, h("b", {text:String(d)}), h("small", {text:MES3[m - 1]})),
      h("span", {class:"sname"}, s.name + (s.qty ? ` (${s.qty})` : ""), h("span", {class:"swhen", text:expLabel(s.exp)}))));
  })));
}
function renderPantry(){
  const root = $("#v-despensa");
  root.replaceChildren();
  notices(root);
  if (prefs.exp || S.stock.length) renderStock(root);
  const all = productList();
  if (!all.length){
    root.append(h("div", {class:"empty"}, h("b", {text:"Todavía no hay nada en la despensa"}),
      "Cada vez que terminéis una compra, lo comprado aparece aquí con una estimación de cuánto os queda."));
    return;
  }
  root.append(h("h3", {class:"sec", text:"Lo que se va gastando"}),
    h("p", {class:"intro", text:`Estimación según cada cuánto compráis cada cosa y que sois ${peopleTxt(people())}. Toca un producto para ajustarlo.`}));
  const onList = listKeys();
  const vis = all.filter(p => !p.hidden).map(p => ({p, st:statusOf(p)}))
    .sort((a, b) => (b.st ? b.st.ratio : -1) - (a.st ? a.st.ratio : -1) || a.p.name.localeCompare(b.p.name, "es"));
  const ul = h("ul", {class:"pantry"});
  for (const {p, st} of vis){
    const lvl = st ? st.level : "none";
    ul.append(h("li", null, h("button", {class:"prod", type:"button", onclick:() => openProduct(p)},
      h("div", {class:"prod-top"},
        h("span", {class:"prod-name"}, p.name, onList.has(p.key) ? h("span", {class:"on-list", text:"En la lista"}) : null),
        h("span", {class:`prod-state st-${lvl}`, text:stateLabel(st)})),
      st ? gauge(st) : null,
      h("div", {class:"prod-meta", text:st ? reasonLine(p, st) : `Lo comprasteis ${ago(lastBuy(p))}. Con una compra más ya podré estimarlo.`}))));
  }
  root.append(ul);
  const hidden = all.filter(p => p.hidden);
  if (hidden.length){
    root.append(h("button", {class:"link-btn", type:"button", onclick:() => { S.showHidden = !S.showHidden; renderPantry(); }},
      S.showHidden ? "Ocultar los que ya no compráis" : `Ver los que ya no compráis (${hidden.length})`));
    if (S.showHidden){
      root.append(h("ul", {class:"pantry"}, hidden.map(p => h("li", null,
        h("button", {class:"prod", type:"button", onclick:() => openProduct(p)},
          h("div", {class:"prod-top"}, h("span", {class:"prod-name", text:p.name}), h("span", {class:"prod-state st-none", text:"Sin sugerencias"})))))));
    }
  }
}
const dateFmt = new Intl.DateTimeFormat("es-ES", {weekday:"long", day:"numeric", month:"long"});
function renderHistory(){
  const root = $("#v-historial");
  root.replaceChildren();
  notices(root);
  const top = productList().filter(p => (p.total || 0) > 0).sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 10);
  if (!top.length && !S.trips.length){
    root.append(h("div", {class:"empty"}, h("b", {text:"Aún no hay compras guardadas"}),
      "Cuando terminéis en el súper, pulsa «Terminar compra» y quedará aquí registrada."));
    return;
  }
  if (top.length){
    root.append(h("h3", {class:"sec", text:"Lo que más compráis"}),
      h("ul", {class:"top-list"}, top.map(p => h("li", null, p.name, h("b", {text:`×${p.total}`})))));
  }
  if (S.trips.length){
    root.append(h("h3", {class:"sec", text:"Últimas compras"}));
    for (const t of S.trips){
      const d = dateFmt.format(new Date(t.t));
      root.append(h("details", {class:"trip"},
        h("summary", null, h("span", {class:"when", text:d.charAt(0).toUpperCase() + d.slice(1)}),
          h("span", {class:"n", text:`${t.n} ${t.n === 1 ? "producto" : "productos"}`}), avatar(t.by, "Compra hecha por")),
        h("p", {class:"names", text:(t.names || []).join(", ")})));
    }
  }
}
function renderSetup(){
  const root = $("#v-setup");
  root.replaceChildren();
  if (S.setup === "household"){
    const code = h("input", {id:"fCode", placeholder:"Pega aquí el enlace o el código", autocomplete:"off"});
    const name = h("input", {id:"fSetupName", placeholder:"Tu nombre", value:prefs.name, maxlength:"30", autocomplete:"given-name"});
    root.append(h("div", {class:"setup"},
      h("h2", {text:"La lista de la compra de tu casa"}),
      h("p", {text:"Crea la lista y manda el enlace al resto de la familia, o únete a una que ya exista."}),
      h("label", {class:"field"}, h("span", {text:"¿Cómo te llamas?"}), name),
      h("button", {class:"btn btn-primary", type:"button", onclick:() => {
        prefs.name = name.value.trim().slice(0, 30); prefs.household = randId(20); savePrefs(); boot(true);
      }}, "Crear la lista de mi casa"),
      h("label", {class:"field"}, h("span", {text:"¿Ya te han invitado?"}), code),
      h("button", {class:"btn btn-ghost", type:"button", onclick:() => {
        const m = code.value.match(/casa=([a-z0-9]{16,})/i) || code.value.trim().match(/^([a-z0-9]{16,})$/i);
        if (!m){ toast("Ese enlace no es válido. Pide que te lo vuelvan a mandar."); return; }
        prefs.name = name.value.trim().slice(0, 30); prefs.household = m[1].toLowerCase(); savePrefs(); boot();
      }}, "Unirme con el enlace")));
  } else if (S.setup === "error"){
    root.append(h("div", {class:"setup"},
      h("h2", {text:"No se puede abrir la lista"}),
      h("p", {text:S.err || "Revisa la conexión y vuelve a intentarlo."}),
      h("button", {class:"btn btn-primary", type:"button", onclick:() => location.reload()}, "Reintentar")));
  }
}
function render(){
  const setup = !!S.setup;
  $("#v-setup").hidden = !setup;
  document.querySelector(".adder").hidden = setup;
  document.querySelector(".tabs").hidden = setup;
  $("#peopleBtn").hidden = setup; $("#gearBtn").hidden = setup;
  if (setup){
    ["lista", "despensa", "historial"].forEach(v => { $("#v-" + v).hidden = true; });
    $("#checkout").hidden = true;
    renderSetup();
    return;
  }
  const n = peopleKnown() ? people() : null;
  $("#peopleN").textContent = n ? (n === 1 ? "1 en casa" : `${n} en casa`) : "¿cuántos?";
  $("#homeName").textContent = (S.config.name || "").trim() || "La compra";
  document.title = $("#homeName").textContent;
  const pending = S.items.filter(i => !i.checked).length;
  $("#cList").textContent = pending ? String(pending) : "";
  const outN = productList().filter(p => !p.hidden).map(statusOf).filter(st => st && st.level === "out").length;
  const expN = prefs.exp ? S.stock.filter(s => s.exp && daysUntil(s.exp) <= 0).length : 0;
  const alertN = outN + expN;
  const cP = $("#cPantry"); cP.textContent = alertN ? String(alertN) : ""; cP.classList.toggle("alert", alertN > 0);
  for (const v of ["lista", "despensa", "historial"]){
    $("#v-" + v).hidden = S.view !== v;
    const a = document.querySelector(`.tabs a[data-view="${v}"]`);
    if (S.view === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  if (S.view === "lista") renderList();
  else if (S.view === "despensa") renderPantry();
  else renderHistory();
  const done = S.items.filter(i => i.checked).length;
  $("#checkout").hidden = !(S.view === "lista" && done > 0);
  $("#checkoutBtn").textContent = `Terminar compra (${done} en el carro)`;
  maybeExpiryAlert();
}

/* ---------- Navegación ---------- */
function route(){
  const v = (location.hash || "").slice(1);
  S.view = ["lista", "despensa", "historial"].includes(v) ? v : "lista";
  render();
}
window.addEventListener("hashchange", route);

/* ---------- Entrada y autocompletado ---------- */
const input = $("#addInput"), ac = $("#ac");
let acSel = -1;
function acItems(){
  const q = keyOf(input.value.split(/[,;]/).pop());
  if (!q) return [];
  const onList = listKeys();
  return productList().filter(p => !onList.has(p.key) && p.key.includes(q) && p.key !== q)
    .sort((a, b) => (a.key.startsWith(q) ? 0 : 1) - (b.key.startsWith(q) ? 0 : 1) || (b.total || 0) - (a.total || 0)).slice(0, 5);
}
function renderAc(){
  const list = acItems();
  if (!list.length || document.activeElement !== input){ ac.hidden = true; acSel = -1; return; }
  if (acSel >= list.length) acSel = list.length - 1;
  ac.replaceChildren(...list.map((p, i) => h("button", {type:"button", class:i === acSel ? "on" : "", tabindex:"-1",
    onmousedown:e => e.preventDefault(), onclick:() => pickAc(p)},
    h("span", {text:p.name}), h("small", {text:`comprado ${p.total || 1} ${(p.total || 1) === 1 ? "vez" : "veces"}`}))));
  ac.hidden = false;
}
function pickAc(p){
  const parts = input.value.split(/([,;])/);
  parts[parts.length - 1] = (parts.length > 1 ? " " : "") + p.name;
  input.value = parts.join("");
  submit();
}
function submit(){
  const v = input.value.trim();
  if (!v || !S.db) return;
  input.value = ""; ac.hidden = true; acSel = -1;
  const n = addEntries(v);
  if (n > 1) toast(`${n} productos apuntados`);
  if (S.view !== "lista") location.hash = "#lista";
}
input.addEventListener("input", () => { acSel = -1; renderAc(); });
input.addEventListener("focus", renderAc);
input.addEventListener("blur", () => setTimeout(() => { ac.hidden = true; }, 120));
input.addEventListener("keydown", e => {
  const list = ac.hidden ? [] : acItems();
  if (e.key === "ArrowDown" && list.length){ e.preventDefault(); acSel = (acSel + 1) % list.length; renderAc(); }
  else if (e.key === "ArrowUp" && list.length){ e.preventDefault(); acSel = acSel <= 0 ? list.length - 1 : acSel - 1; renderAc(); }
  else if (e.key === "Enter"){ e.preventDefault(); if (acSel >= 0 && list[acSel]) pickAc(list[acSel]); else submit(); }
  else if (e.key === "Escape"){ ac.hidden = true; }
});
$("#addBtn").addEventListener("click", submit);
$("#peopleBtn").addEventListener("click", openSettings);
$("#gearBtn").addEventListener("click", openSettings);
$("#checkoutBtn").addEventListener("click", openCheckout);

/* Dictado de productos */
if (canListen){
  const mic = $("#micBtn");
  mic.hidden = false;
  let rec = null;
  const PH = input.placeholder;
  mic.addEventListener("click", () => {
    if (rec){ try { rec.stop(); } catch {} return; }
    mic.classList.add("live"); mic.setAttribute("aria-label", "Parar dictado");
    input.placeholder = "Te escucho… di los productos";
    rec = listen({
      onPartial:t => { input.placeholder = t; },
      onFinal:alts => {
        const t = alts[0].replace(/\s+y\s+/gi, ", ").replace(/\.\s*$/, "").trim();
        input.value = (input.value.trim() ? input.value.trim().replace(/[,;]?$/, ", ") : "") + t;
      },
      onEnd:err => {
        rec = null; mic.classList.remove("live"); mic.setAttribute("aria-label", "Dictar productos"); input.placeholder = PH;
        if (err === "not-allowed" || err === "service-not-allowed") toast("El navegador no deja usar el micrófono.");
        if (input.value.trim()) input.focus();
      }
    });
    if (!rec){ mic.classList.remove("live"); input.placeholder = PH; toast("El dictado no está disponible en este navegador."); }
  });
}

/* ---------- Arranque ---------- */
let unsubs = [];
async function boot(isNew){
  unsubs.forEach(f => { try { f(); } catch {} }); unsubs = [];
  const cfg = (window.APP_CONFIG && window.APP_CONFIG.firebase) || null;
  // ¿Viene con invitación en el enlace?
  const params = new URLSearchParams(location.search);
  const inv = (params.get("casa") || "").toLowerCase();
  if (inv && /^[a-z0-9]{16,}$/.test(inv)){
    prefs.household = inv; savePrefs();
    params.delete("casa");
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "") + location.hash);
  }
  if (cfg && !prefs.household){ S.setup = "household"; render(); return; }
  S.setup = null; S.err = null;
  try {
    if (cfg){ S.db = await makeFirebaseDb(cfg, prefs.household); S.mode = "firebase"; }
    else { S.db = makeLocalDb(); S.mode = "local"; }
  } catch (e){
    console.error(e);
    S.setup = "error";
    S.err = e && e.code === "auth/operation-not-allowed"
      ? "Falta activar el acceso anónimo en Firebase (Authentication › Sign-in method › Anónimo). Mira el README."
      : "No se ha podido conectar con Firebase. Revisa la conexión y los datos de config.js.";
    render(); return;
  }
  route();
  const timer = setTimeout(() => { if (!S.itemsLoaded) S.loadFail = true; else S.stale = true; render(); }, 10000);
  const onErr = e => {
    clearTimeout(timer); S.itemsLoaded = true;
    S.err = e && e.code === "permission-denied"
      ? "Firebase no da permiso para leer la lista. Revisa que hayas publicado las reglas de firestore.rules (mira el README)."
      : "Se ha cortado la conexión con la lista. Vuelve a abrir la app.";
    render();
  };
  const fresh = snap => { if (!snap.metadata.fromCache){ clearTimeout(timer); S.loadFail = false; S.stale = false; } };
  unsubs.push(S.db.collection("items").onSnapshot(snap => {
    S.items = snap.docs.map(d => ({id:d.id, ...d.data()}));
    S.itemsLoaded = true; fresh(snap); render();
  }, onErr));
  unsubs.push(S.db.collection("products").onSnapshot(snap => {
    const m = {}; for (const d of snap.docs) m[d.id] = d.data();
    S.products = m; render();
  }, onErr));
  unsubs.push(S.db.collection("stock").onSnapshot(snap => {
    S.stock = snap.docs.map(d => ({id:d.id, ...d.data()}));
    S.stockLoaded = true; render();
  }, onErr));
  unsubs.push(S.db.doc("config/home").onSnapshot(snap => {
    S.config = snap.exists ? {...snap.data()} : {};
    S.configLoaded = !snap.metadata.fromCache || snap.exists;
    render();
  }, onErr));
  unsubs.push(S.db.collection("trips").orderBy("t", "desc").limit(25).onSnapshot(snap => {
    S.trips = snap.docs.map(d => ({id:d.id, ...d.data()}));
    if (S.view === "historial") render();
  }, onErr));
  if (isNew) setTimeout(() => { openSettings(); toast("Lista creada. Invita a tu familia desde aquí."); }, 400);
}
// Si la app se queda abierta de un día para otro, vuelve a avisar al volver a ella
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible"){
    const today = new Date().toDateString();
    if (S.alertDay && S.alertDay !== today){ S.alertShown = false; }
    S.alertDay = today;
    render();
  }
});
S.alertDay = new Date().toDateString();
const NApp = plugin("App");
if (NApp){
  NApp.addListener("backButton", () => {
    if (!$("#sheetWrap").hidden) closeSheet();
    else if (S.view !== "lista" && !S.setup) location.hash = "#lista";
    else NApp.exitApp();
  });
  NApp.addListener("resume", () => document.dispatchEvent(new Event("visibilitychange")));
}

if (!isNative && "serviceWorker" in navigator && location.protocol === "https:"){
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
boot();
})();
