// Team brief: section nav, language switch, shared sticky notes.
(() => {
  const UI = {
    en: { add: "Add a note", place: "Tap where you want to stick it", cancel: "Cancel", name: "Your name", nameHint: "So the team knows who wrote it", next: "Next", note: "Your note", save: "Stick it", del: "Delete", delAsk: "Delete this note?", saveErr: "Couldn't save. Check your connection and try again." },
    zh: { add: "贴个标签", place: "点一下你想贴的位置", cancel: "取消", name: "你的名字", nameHint: "让大家知道是谁写的", next: "下一步", note: "写下你的想法", save: "贴上去", del: "删除", delAsk: "删除这个标签？", saveErr: "没存上，检查一下网络再试。" },
    ru: { add: "Добавить заметку", place: "Нажмите туда, где хотите оставить заметку", cancel: "Отмена", name: "Ваше имя", nameHint: "Чтобы команда знала, кто написал", next: "Далее", note: "Ваша заметка", save: "Прикрепить", del: "Удалить", delAsk: "Удалить эту заметку?", saveErr: "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз." },
  };
  const LANG_NAMES = { en: "EN", zh: "中文", ru: "RU", hi: "हिं", ta: "தமிழ்", bn: "বাং", te: "తెలు", mr: "मरा", kk: "ҚАЗ" };
  const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
  const BLOCKS = "h2, h3, p, li, figure, .plan, .why, details, .risk, .card, .tags, .note, table";

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const langs = [...document.querySelectorAll(".lang")];
  const codes = langs.map(l => l.dataset.lang);
  let cur = codes[0];
  const t = k => (UI[cur] || UI.en)[k];

  // ---------- language ----------
  const langBox = document.querySelector(".langs");
  codes.forEach(c => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = LANG_NAMES[c] || c.toUpperCase(); b.dataset.code = c;
    b.addEventListener("click", () => setLang(c, true));
    langBox.appendChild(b);
  });
  if (codes.length < 2) langBox.hidden = true;

  function setLang(c, keepPlace) {
    const sec = keepPlace ? currentSec() : null;
    cur = c; ls.set("brief-lang", c);
    langs.forEach(l => l.hidden = l.dataset.lang !== c);
    langBox.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.code === c));
    document.documentElement.lang = active().getAttribute("lang") || c;
    buildNav(); renderUI(); renderNotes();
    if (sec) { const h = active().querySelector(`h2[data-sec="${sec}"]`); if (h) h.scrollIntoView(); }
  }
  const active = () => langs.find(l => l.dataset.lang === cur);

  // ---------- section nav ----------
  const secBox = document.querySelector(".secs");
  let io;
  function buildNav() {
    secBox.textContent = "";
    const hs = [...active().querySelectorAll("h2[data-sec]")];
    hs.forEach(h => {
      const a = document.createElement("a");
      a.href = "#" + h.dataset.sec; a.textContent = h.dataset.nav; a.dataset.sec = h.dataset.sec;
      a.addEventListener("click", e => { e.preventDefault(); h.scrollIntoView({ behavior: "smooth" }); history.replaceState(null, "", "#" + h.dataset.sec); });
      secBox.appendChild(a);
    });
    if (io) io.disconnect();
    io = new IntersectionObserver(() => markNav(), { rootMargin: "-70px 0px -60% 0px" });
    hs.forEach(h => io.observe(h));
    markNav();
  }
  function currentSec() {
    const hs = [...active().querySelectorAll("h2[data-sec]")];
    let s = hs[0] && hs[0].dataset.sec;
    for (const h of hs) if (h.getBoundingClientRect().top < 160) s = h.dataset.sec;
    return s;
  }
  function markNav() {
    const s = currentSec();
    secBox.querySelectorAll("a").forEach(a => {
      const on = a.dataset.sec === s;
      // scroll only the nav strip; scrollIntoView here would cancel the page's smooth scroll
      if (on && !a.classList.contains("on")) secBox.scrollTo({ left: a.offsetLeft - secBox.clientWidth / 2 + a.offsetWidth / 2 });
      a.classList.toggle("on", on);
    });
  }
  let navT; addEventListener("scroll", () => { clearTimeout(navT); navT = setTimeout(markNav, 60); }, { passive: true });

  // ---------- notes store (Firebase when configured, else this browser only) ----------
  const me = ls.get("brief-uid") || (() => { const id = Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set("brief-uid", id); return id; })();
  let notes = [];
  const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  const fbStore = cfg => {
    const ready = (async () => {
      const { initializeApp } = await import(FB + "firebase-app.js");
      const fs = await import(FB + "firebase-firestore.js");
      return { fs, db: fs.getFirestore(initializeApp(cfg)) };
    })();
    return {
      subscribe(cb) {
        ready.then(({ fs, db }) => fs.onSnapshot(fs.collection(db, "notes"),
          snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.ts - b.ts)),
          err => console.error("notes", err)));
      },
      async add(n) { const { fs, db } = await ready; await fs.addDoc(fs.collection(db, "notes"), n); },
      async remove(id) { const { fs, db } = await ready; await fs.deleteDoc(fs.doc(db, "notes", id)); },
    };
  };
  const store = window.FIREBASE_CONFIG ? fbStore(window.FIREBASE_CONFIG) : {
    subscribe(cb) { const read = () => { try { cb(JSON.parse(ls.get("brief-notes") || "[]")); } catch { cb([]); } }; read(); addEventListener("storage", read); },
    async add(n) { const all = JSON.parse(ls.get("brief-notes") || "[]"); all.push({ ...n, id: Math.random().toString(36).slice(2) }); ls.set("brief-notes", JSON.stringify(all)); dispatchEvent(new Event("storage")); },
    async remove(id) { const all = JSON.parse(ls.get("brief-notes") || "[]").filter(n => n.id !== id); ls.set("brief-notes", JSON.stringify(all)); dispatchEvent(new Event("storage")); },
  };

  // stable block keys: same structure in every language
  const blocksOf = l => [...l.querySelectorAll("main")].flatMap(m => [...m.querySelectorAll(BLOCKS)]);
  const keyOf = el => blocksOf(active()).indexOf(el);

  function renderNotes() {
    document.querySelectorAll(".stick").forEach(s => s.remove());
    const list = blocksOf(active());
    for (const n of notes) {
      const host = list[n.block]; if (!host) continue;
      host.classList.add("notable");
      const s = document.createElement("div");
      s.className = "stick" + (n.x > .6 ? " right" : "");
      s.style.left = `clamp(0px, ${(n.x * 100).toFixed(2)}%, calc(100% - 120px))`; s.style.top = Math.max(0, n.y) + "px";
      const chip = document.createElement("button");
      chip.type = "button"; chip.className = "chip"; chip.innerHTML = PIN;
      chip.append(document.createTextNode(n.name || "?"));
      chip.addEventListener("click", e => { e.stopPropagation(); const o = s.classList.contains("open"); document.querySelectorAll(".stick.open").forEach(x => x.classList.remove("open")); s.classList.toggle("open", !o); });
      const body = document.createElement("div"); body.className = "body"; body.textContent = n.text;
      const meta = document.createElement("div"); meta.className = "meta";
      const when = document.createElement("span"); when.textContent = n.ts ? new Date(n.ts).toLocaleString() : ""; meta.append(when);
      if (n.uid === me) {
        const d = document.createElement("button"); d.type = "button"; d.className = "del"; d.textContent = t("del");
        d.addEventListener("click", e => { e.stopPropagation(); if (confirm(t("delAsk"))) store.remove(n.id); });
        meta.append(d);
      }
      body.append(meta); s.append(chip, body); host.append(s);
    }
  }
  document.addEventListener("click", e => { if (!e.target.closest(".stick")) document.querySelectorAll(".stick.open").forEach(x => x.classList.remove("open")); });

  // ---------- adding a note ----------
  const fab = document.querySelector(".fab"), bar = document.querySelector(".place-bar");
  function renderUI() {
    fab.querySelector("span").textContent = t("add");
    bar.querySelector("span").textContent = t("place");
    bar.querySelector("button").textContent = t("cancel");
  }
  let hover;
  function stopPlacing() { document.body.classList.remove("placing"); if (hover) hover.classList.remove("notable-hover"); hover = null; }
  fab.addEventListener("click", () => {
    if (ls.get("brief-name")) { document.body.classList.add("placing"); return; }
    askName(() => document.body.classList.add("placing"));
  });
  bar.querySelector("button").addEventListener("click", stopPlacing);
  addEventListener("keydown", e => { if (e.key === "Escape") { stopPlacing(); closePop(); } });
  document.addEventListener("mousemove", e => {
    if (!document.body.classList.contains("placing")) return;
    const b = e.target.closest && e.target.closest(".lang main " + BLOCKS.split(", ").join(", .lang main "));
    if (b === hover) return; if (hover) hover.classList.remove("notable-hover"); hover = b; if (b) b.classList.add("notable-hover");
  });
  document.addEventListener("click", e => {
    if (!document.body.classList.contains("placing")) return;
    if (e.target.closest(".place-bar")) return;
    const main = e.target.closest(".lang main"); if (!main) return;
    const blk = e.target.closest(BLOCKS); if (!blk || !main.contains(blk)) return;
    e.preventDefault(); e.stopPropagation();
    const r = blk.getBoundingClientRect();
    const spot = { block: keyOf(blk), x: Math.min(.98, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.round(e.clientY - r.top) };
    stopPlacing();
    writeNote(spot, e.clientX, e.clientY);
  }, true);

  let pop;
  function closePop() { if (pop) pop.remove(); pop = null; }
  function openPop(x, y, html) {
    closePop();
    pop = document.createElement("div"); pop.className = "pop"; pop.innerHTML = html;
    document.body.append(pop);
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.min(Math.max(16, x - 20), innerWidth - w - 16) + "px";
    pop.style.top = Math.min(Math.max(70, y + 12), innerHeight - h - 16) + "px";
    pop.querySelector(".cancel").addEventListener("click", closePop);
    return pop;
  }
  function askName(then) {
    const r = fab.getBoundingClientRect();
    const p = openPop(r.left, r.top - 190, `<label>${t("name")}</label><input maxlength="30" autocomplete="name"><div style="font-size:12px;opacity:.7;margin-top:4px">${t("nameHint")}</div><div class="row"><button class="cancel" type="button">${t("cancel")}</button><button class="ok" type="button">${t("next")}</button></div>`);
    const inp = p.querySelector("input"); inp.focus();
    const go = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } ls.set("brief-name", v); closePop(); then(); };
    p.querySelector(".ok").addEventListener("click", go);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  }
  function writeNote(spot, x, y) {
    const p = openPop(x, y, `<label>${t("note")} · ${escapeHtml(ls.get("brief-name"))}</label><textarea maxlength="1000"></textarea><div class="row"><button class="cancel" type="button">${t("cancel")}</button><button class="ok" type="button">${t("save")}</button></div>`);
    const ta = p.querySelector("textarea"); ta.focus();
    p.querySelector(".ok").addEventListener("click", async () => {
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      const btn = p.querySelector(".ok"); btn.disabled = true;
      try { await store.add({ ...spot, text, name: ls.get("brief-name"), uid: me, lang: cur, ts: Date.now() }); closePop(); }
      catch { btn.disabled = false; alert(t("saveErr")); }
    });
  }
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- start ----------
  const want = ls.get("brief-lang") || (navigator.language || "en").slice(0, 2);
  setLang(codes.includes(want) ? want : codes[0], false);
  store.subscribe(list => { notes = list; renderNotes(); });
  if (location.hash) { const h = active().querySelector(`h2[data-sec="${location.hash.slice(1)}"]`); if (h) setTimeout(() => h.scrollIntoView(), 50); }
})();
