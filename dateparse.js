/* Interpreta fechas dichas o escritas: «20 11 26», «201126», «20 de noviembre», «veinte del once del veintiséis», «noviembre 2026»… */
const DateParse = (() => {
  const NUMW = {cero:0,un:1,uno:1,una:1,primero:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiun:21,veintiuno:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90};
  const MONTHS = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12,ene:1,feb:2,abr:4,jun:6,jul:7,ago:8,sep:9,sept:9,oct:10,nov:11,dic:12};
  const DAY = 864e5;
  const sod = t => { const x = new Date(t); x.setHours(0,0,0,0); return x.getTime(); };
  const dim = (y, m) => new Date(y, m, 0).getDate();
  const iso = (y, m, d) => `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  function tokens(raw){
    const words = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2")
      .replace(/[^a-z0-9ñ]+/g, " ").trim().split(" ").filter(Boolean);
    const toks = [];
    for (let i = 0; i < words.length; i++){
      const w = words[i];
      if (/^\d+$/.test(w)){ toks.push({n:+w, d:w}); continue; }
      if (MONTHS[w]){ toks.push({m:MONTHS[w]}); continue; }
      if (w === "mil"){
        let base = 1000;
        const prev = toks[toks.length - 1];
        if (prev && prev.w && prev.n < 10){ base = prev.n * 1000; toks.pop(); }
        let add = 0; const nx = words[i + 1];
        if (nx && NUMW[nx] != null){
          add = NUMW[nx]; i++;
          if (add >= 30 && words[i + 1] === "y" && NUMW[words[i + 2]] != null && NUMW[words[i + 2]] < 10){ add += NUMW[words[i + 2]]; i += 2; }
        } else if (nx && /^\d+$/.test(nx)){ add = +nx; i++; }
        toks.push({n:base + add, d:String(base + add), w:true}); continue;
      }
      if (NUMW[w] != null){
        let v = NUMW[w];
        if (v >= 30 && v % 10 === 0 && words[i + 1] === "y" && NUMW[words[i + 2]] != null && NUMW[words[i + 2]] < 10){ v += NUMW[words[i + 2]]; i += 2; }
        toks.push({n:v, d:String(v), w:true}); continue;
      }
      if (w === "hoy") toks.push({rel:0});
      else if (w === "pasado" && words[i + 1] === "manana"){ toks.push({rel:2}); i++; }
      else if (w === "manana") toks.push({rel:1});
    }
    return toks;
  }

  function parse(raw, now = Date.now()){
    const toks = tokens(raw);
    const rel = toks.find(t => t.rel != null);
    if (rel && !toks.some(t => t.n != null)){
      const d = new Date(sod(now) + rel.rel * DAY);
      return {iso:iso(d.getFullYear(), d.getMonth() + 1, d.getDate()), approx:false};
    }
    let d = null, m = null, y = null;
    let nums = toks.filter(t => t.n != null);
    const mi = toks.findIndex(t => t.m);
    // dígitos sueltos «2 0 1 1 2 6»
    if (nums.length >= 4 && nums.every(t => !t.w && t.d.length === 1) && [4, 6, 8].includes(nums.length)){
      const j = nums.map(t => t.d).join(""); nums = [{n:+j, d:j}];
    }
    if (mi >= 0){
      m = toks[mi].m;
      const before = toks.slice(0, mi).filter(t => t.n != null);
      const after = toks.slice(mi + 1).filter(t => t.n != null);
      if (before.length) d = before[before.length - 1].n;
      if (after.length) y = after[0].n;
    } else if (nums.length >= 3){
      [d, m, y] = nums.slice(0, 3).map(t => t.n);
    } else if (nums.length === 2){
      const [a, b] = nums;
      if (!a.w && a.d.length === 4){ d = +a.d.slice(0, 2); m = +a.d.slice(2); y = b.n; }
      else if (b.n >= 1990 || (b.n > 12 && a.n <= 12)){ m = a.n; y = b.n; }
      else { d = a.n; m = b.n; }
    } else if (nums.length === 1){
      const t = nums[0];
      if (!t.w && (t.d.length === 6 || t.d.length === 8)){ d = +t.d.slice(0, 2); m = +t.d.slice(2, 4); y = +t.d.slice(4); }
      else if (!t.w && t.d.length === 4){ d = +t.d.slice(0, 2); m = +t.d.slice(2); }
      else if (t.n >= 1 && t.n <= 31) d = t.n;
      else return null;
    } else return null;

    const today = new Date(sod(now));
    if (y != null){ if (y < 100) y += 2000; if (y < 2000 || y > 2100) return null; }
    if (m == null){
      m = today.getMonth() + 1; y = today.getFullYear();
      if (d < today.getDate()){ m++; if (m > 12){ m = 1; y++; } }
    }
    if (m < 1 || m > 12) return null;
    if (y == null){
      y = today.getFullYear();
      const cand = new Date(y, m - 1, d == null ? dim(y, m) : Math.min(d, 31)).getTime();
      if (cand < sod(now) - 30 * DAY) y++;
    }
    const approx = d == null;
    if (d == null) d = dim(y, m);
    if (d < 1 || d > dim(y, m)) return null;
    return {iso:iso(y, m, d), approx};
  }
  return {parse};
})();
if (typeof module !== "undefined") module.exports = DateParse;
