"use strict";
const { topics, problems } = CCC_DATA;
const byId = id => document.getElementById(id);
const key = "ccc-practice-v1";
const methods = {
  independent: { label: "独立写出", points: 3, level: 0, days: 7 },
  hint: { label: "提示后写出", points: 2, level: 1, days: 3 },
  solution: { label: "看解法后写出", points: 1, level: 2, days: 1 }
};
const tabs = { hint: "提示", solution: "解法", notes: "我的笔记" };
const records = () => ({ score: 0, level: 0, hints: 0, events: [], note: "", done: false, due: 0 });
let db = {};
try { db = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
let selected = Object.hasOwn(problems, decodeURIComponentForHash()) ? decodeURIComponentForHash() : "2662";
let selectedTopic = topics.find(t => t.problems.includes(selected));
let tab = "hint", review = false, timer, saveFailed = false;
let matches = [], cursor = 0;
function decodeURIComponentForHash() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return ""; }
}
function escape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}
function state(id = selected) { return db[id] || records(); }
function edit() { return db[selected] ||= records(); }
function save() {
  try { localStorage.setItem(key, JSON.stringify(db)); }
  catch { if (!saveFailed) toast("浏览器无法保存。请用「进度备份」导出。"); saveFailed = true; }
}
function toast(msg) {
  const el = byId("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => el.hidden = true, 3200);
}
function isDue(r) { return r.due > 0 && r.due <= Date.now() && r.score < 10; }
function gains(r, name) {
  const first = !r.events.some(e => e.success);
  return Math.max(0, Math.min(name === "independent" ? 10 : 6, r.score + methods[name].points + Number(first)) - r.score);
}
function log(name) {
  const r = edit();
  if (name === "miss") {
    if (r.done) return;
    r.events.unshift({ label: "还没写出", gain: 0, at: Date.now(), success: false });
    r.due = Date.now();
  } else {
    const method = methods[name];
    if (!method || r.done || r.level > method.level) return;
    const first = !r.events.some(e => e.success);
    const gain = gains(r, name);
    r.score += gain;
    r.due = Date.now() + method.days * 86400000;
    r.events.unshift({ label: method.label, gain, at: Date.now(), success: true, first });
  }
  r.done = true;
  save(); renderLedger(); renderList(); renderTop();
  toast(name === "miss" ? "已加入待复习" : "已记下这次写出");
}
function newAttempt() {
  const r = edit();
  r.done = false; r.level = 0; r.hints = 0;
  save(); setTab("hint"); byId("tab-hint")?.focus();
}
const displayId = id => /^\d+$/.test(id) ? "LC " + id : id.replace("CCC ", "");
const date = timestamp => new Intl.DateTimeFormat("zh-CN", { month:"numeric", day:"numeric" }).format(timestamp);
function renderTop() {
  byId("nav-due").textContent = Object.keys(problems).filter(id => isDue(state(id))).length;
}
const normalize = value => value.toLowerCase().normalize("NFKC")
  .replace(/[\u2010-\u2015−]/g, "-").replace(/[^\p{L}\p{N}]+/gu, "");
const aliases = {
  "2662":"特殊道路 曼哈顿距离 Dijkstra djikstra", "1368":"箭头 01bfs 0-1 BFS",
  "1976":"最短路计数 最短路径条数", "2290":"障碍物 01bfs", "3286":"安全路径 生命值 01bfs",
  "1":"两数之和", "15":"三数之和", "239":"滑动窗口最大值", "307":"BIT Fenwick Tree",
  "778":"水位 游泳", "1654":"跳跃 回家", "743":"网络延迟", "1202":"可交换字符串",
  "994":"腐烂橘子 烂橘子", "1046":"最后一块石头", "207":"课程表 拓扑排序"
};
const index = Object.values(problems).map(q => {
  const related = topics.filter(t => t.problems.includes(q.id));
  return { ...q, related, idKey:normalize("LC "+q.id), titleKey:normalize(q.title),
    searchable:normalize([q.id,q.title,q.summary||"",aliases[q.id]||"",...related.flatMap(t=>[t.name,t.chapter])].join(" ")) };
});
function rank(q, raw) {
  const normalized = normalize(raw);
  const bare = normalized.replace(/^leetcode|^lc/, "");
  if (!normalized) return 1;
  if (normalize(q.id) === bare || q.idKey === normalized) return 100;
  if (/^\d+$/.test(bare)) return q.id.startsWith(bare) ? 70 : 0;
  if (q.titleKey.startsWith(normalized)) return 85;
  if (q.titleKey.includes(normalized)) return 75;
  if (q.searchable.includes(normalized)) return 60;
  const tokens = raw.toLowerCase().split(/\s+/).map(normalize).filter(Boolean);
  return tokens.length && tokens.every(token=>q.searchable.includes(token)) ? 40 : 0;
}
function renderList() {
  const raw = byId("search").value.trim();
  let items = index.filter(q => !review || isDue(state(q.id))).map(q=>({q,score:rank(q,raw)}))
    .filter(x=>x.score).sort((a,b)=>b.score-a.score);
  if (!raw && !review) {
    const recent = getRecent();
    const featured = [...new Set([...recent,selected,"2662","1976","1368","2290","3286"])];
    items = featured.map(id=>items.find(item=>item.q.id===id)).filter(Boolean);
  }
  matches = items.slice(0,12).map(x=>x.q);
  cursor = 0;
  const searchable = normalize(raw);
  byId("search-summary").textContent = raw || review ?
    items.length + " 道题" + (items.length>matches.length ? " · 先显示最相关的 12 道" : "") : "最近与常用";
  byId("list").innerHTML = matches.map((q,i) => {
    const topic = searchable && q.related.find(t=>normalize(t.name).includes(searchable)) || q.related[0];
    return '<button class="entry'+(i===0?' active':'')+'" data-problem="'+escape(q.id)+'" data-topic="'+topic.id+
      '"><span class="mono">'+escape(displayId(q.id))+'</span><span class="result-title"><strong>'+escape(q.title)+
      '</strong><small>'+escape(topic.name)+'</small></span><span class="mono">'+state(q.id).score+'/10</span></button>';
  }).join("") || '<p class="empty">'+(review?"目前没有符合条件的待复习题。":"没有匹配的题目。")+'</p>';
}
function getRecent() {
  try { return JSON.parse(localStorage.getItem(key+"-recent")||"[]"); } catch { return []; }
}
function showSearch(onlyDue=false) {
  review = onlyDue;
  byId("search-title").textContent = review ? "待复习" : "查题";
  byId("search").value = "";
  renderList();
  if (!byId("search-dialog").open) byId("search-dialog").showModal();
  byId("search").focus();
}
function historyEntry(e) {
  return '<li><time>' + date(e.at) + '</time>' + escape(e.first ? "首次 · " + e.label : e.label) +
    ' <span class="mono">+' + e.gain + '</span></li>';
}
function renderLedger() {
  const r = state();
  const tick = Array.from({length:10}, (_,i) => '<i' + (i<r.score ? ' class="on"' : '') + '></i>').join("");
  const due = r.score === 10 ? "已达到满熟练度" : !r.due ? "完成一次练习后安排复习" : isDue(r) ? "今天可以重做" : "下次复习 " + date(r.due);
  const help = ["本轮尚未看提示或解法","本轮已看提示","本轮已看解法或模板"][r.level];
  const buttons = Object.entries(methods).map(([name, method],i) =>
    '<button class="result' + (i ? ' alt' : '') + '" data-result="' + name + '"' + (r.level > method.level ? ' disabled' : '') + '>' +
    method.label + ' <span>+' + gains(r,name) + '</span></button>').join("");
  byId("ledger").innerHTML =
    '<div class="scorecard"><h2>熟练度</h2><div class="score"><strong>' + r.score +
    '</strong><span>/ 10</span></div><div class="ticks" aria-hidden="true">' + tick + '</div><p>' + due + '</p></div>' +
    '<div class="log"><h2>记下本轮</h2><p class="muted">' + (r.done ? '本轮已记录' : help) + '</p>' +
    (r.done ? '<button class="result" data-act="new">开始新一轮</button>' : buttons +
      '<button class="result alt" data-result="miss">还没写出 <span>+0</span></button>') +
    '<details><summary>计分规则</summary><p class="muted">独立 +3，提示 +2，解法 +1。第一次写出再 +1。借助提示或解法最多升到 6 分。每轮只记录一次。</p></details></div>' +
    '<div class="log"><h2>练习记录</h2>' + (r.events.length ? '<ul class="history">' + r.events.map(historyEntry).join("") +
    '</ul>' : '<p class="muted">首次练习将在这里显示。</p>') + '</div>';
}
function renderHead() {
  const q = problems[selected];
  const difficulty = { Easy:"简单", Medium:"中等", Hard:"困难" }[q.meta[1]];
  byId("problem-head").innerHTML = '<p class="eyebrow"><span>' + escape(displayId(selected)) +
    '</span><span>' + escape(selectedTopic.name) + '</span>' + (difficulty ? '<span>' + difficulty + '</span>' : '') +
    '</p><h1>' + escape(q.title) + '</h1><div class="hero-actions"><a target="_blank" rel="noopener" href="' + escape(q.url) +
    '">打开原题</a><button class="topic-link" id="current-template" type="button">本题算法模板</button></div>';
  byId("statement").innerHTML = '<h2>题意</h2><p>' + escape(q.summary) + '</p>' +
    (q.source ? '<p class="statement-source">' + escape(q.source) + '</p>' : '');
  byId("current-template").onclick = () => openTemplates(selectedTopic.id);
}
function setTab(value, focus = false) {
  tab = value;
  renderSheet(); renderLedger();
  if (focus) byId("tab-" + value).focus();
}
function renderSheet() {
  const q = problems[selected], r = state();
  const guide = CCC_GUIDES[selected] || [];
  let body = "";
  if (tab === "hint") {
    const levels = ["观察条件", "确定状态或结构", "检查转移与边界"];
    body = '';
    for (let i=0;i<r.hints;i++) {
      body += '<div class="hint"><strong>提示 ' + (i+1) + ' · ' + levels[i] + '</strong><p>' + escape(guide[i]) + '</p></div>';
    }
    if (r.hints < 3) body += '<button class="reveal" data-act="hint">揭开提示 ' + (r.hints+1) + '</button>';
  } else if (tab === "solution") {
    if (r.level < 2) body = '<p class="small">展开会记为本轮看过解法。</p><button class="primary" data-act="solution">查看解法</button>';
    else body = '<h2>本题解法</h2><p>' + escape(guide[3]) + '</p><details><summary>专题笔记与 Java 模板</summary>' +
      selectedTopic.notes.map(n => '<p>' + escape(n) + '</p>').join("") + '<pre><code>' + escape(selectedTopic.code) + '</code></pre>' +
      '<button class="quiet" data-act="copy">复制 Java 模板</button></details>' +
      (/^\d+$/.test(selected) ? '<div class="actions"><a target="_blank" rel="noopener" href="' + escape(q.url.replace(/\/?$/,"/solutions/")) + '">查看 LeetCode 题解区</a></div>' : "");
  } else {
    const previous = q.meta.length ? '<p class="small">旧提交记录 · ' + q.meta.map(escape).join(" · ") + '</p>' : "";
    body = '<label class="field" for="note">本题复盘</label><textarea id="note" class="note" placeholder="我的卡点是什么？\n核心状态怎么定义？\n改哪个条件后，原方法会失效？">' +
      escape(r.note) + '</textarea><p class="small">笔记自动保存</p>' + previous;
  }
  const nav = Object.entries(tabs).map(([id,label]) => '<button role="tab" id="tab-' + id + '" aria-controls="tab-panel" data-tab="' + id + '" aria-selected="' + (id===tab) + '" tabindex="' + (id===tab ? 0 : -1) + '">' + label + '</button>').join("");
  byId("sheet").innerHTML = '<div class="tabs" role="tablist" aria-label="本题工作区">' + nav +
    '</div><div class="panel" id="tab-panel" role="tabpanel" aria-labelledby="tab-' + tab + '">' + body + '</div>';
}
function select(id, topicId) {
  selected = id; selectedTopic = topics[topicId]; tab = "hint";
  history.replaceState(null, "", "#" + encodeURIComponent(id));
  try { localStorage.setItem(key+"-recent", JSON.stringify([id,...getRecent().filter(x=>x!==id)].slice(0,6))); } catch {}
  if (byId("search-dialog").open) byId("search-dialog").close();
  renderHead(); renderSheet(); renderLedger(); renderList();
  window.scrollTo(0,0);
  byId("practice").focus({preventScroll:true});
}
byId("search").addEventListener("input",renderList);
byId("find").onclick = () => showSearch();
byId("nav-review").onclick = () => showSearch(true);
byId("home-link").onclick = e => { e.preventDefault(); showSearch(); };
document.addEventListener("keydown",e => {
  if (e.isComposing) return;
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==="k") ||
      (e.key==="/" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest("input,textarea,select,[contenteditable],dialog"))) {
    if (byId("backup-dialog").open || byId("templates-dialog").open || byId("resources-dialog").open) return;
    e.preventDefault(); showSearch(); return;
  }
  if (e.target.id==="search" && matches.length && ["ArrowUp","ArrowDown","Enter"].includes(e.key)) {
    e.preventDefault();
    const rows = [...byId("list").querySelectorAll(".entry")];
    if (e.key==="Enter") rows[cursor].click();
    else {
      rows[cursor].classList.remove("active");
      cursor = (cursor+rows.length+(e.key==="ArrowUp"?-1:1))%rows.length;
      rows[cursor].classList.add("active");
      rows[cursor].scrollIntoView({block:"nearest"});
    }
  }
  if (e.target.matches('[role="tab"]') && ["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) {
    const names = Object.keys(tabs), i = names.indexOf(tab);
    e.preventDefault();
    setTab(names[e.key==="Home" ? 0 : e.key==="End" ? names.length-1 : (i+names.length+(e.key==="ArrowLeft"?-1:1))%names.length],true);
  }
});
byId("sheet").addEventListener("input", e => {
  if (e.target.id === "note") { edit()[e.target.id] = e.target.value; save(); }
});
document.addEventListener("click",async e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.close) byId(b.dataset.close).close();
  if (b.dataset.problem) select(b.dataset.problem, Number(b.dataset.topic));
  if (b.dataset.tab) setTab(b.dataset.tab,true);
  if (b.dataset.result) log(b.dataset.result);
  if (b.dataset.act === "new") newAttempt();
  if (b.dataset.act === "hint") {
    const r = edit(); r.level = Math.max(r.level,1); r.hints = Math.min(3,r.hints+1); save(); renderSheet(); renderLedger();
    byId("sheet").querySelector('[data-act="hint"]')?.focus();
  }
  if (b.dataset.act === "solution") { edit().level = 2; save(); renderSheet(); renderLedger(); }
  if (b.dataset.act === "copy") {
    try { await navigator.clipboard.writeText(selectedTopic.code); toast("已复制 Java 模板"); }
    catch { toast("可选中代码后手动复制。"); }
  }
});
const templateSelect = byId("template-select");
templateSelect.innerHTML = topics.map(t => '<option value="'+ t.id +'">'+ escape(t.name) +'</option>').join("");
function renderTemplate(showCode) {
  const t = topics[Number(templateSelect.value)];
  if (!t) return;
  const relevant = t.problems.includes(selected) && !state().done && state().level < 2;
  const lines = t.notes.map(n=>'<p>'+escape(n)+'</p>').join("");
  byId("template-content").innerHTML = showCode ?
    lines+'<pre><code>'+escape(t.code)+'</code></pre><button class="reveal" id="copy-template" type="button">复制 Java 代码</button>' :
    '<p>'+(relevant?'展开后，本轮会记为看过解法。':'')+'</p><button class="reveal" id="show-template" type="button">展开 Java 模板</button>';
  if (showCode) byId("copy-template").onclick = async () => {
    try { await navigator.clipboard.writeText(t.code); toast("已复制 Java 模板"); }
    catch { toast("可以手动选中代码复制"); }
  };
  else byId("show-template").onclick = () => {
    if (relevant) { edit().level = 2; save(); renderLedger(); renderSheet(); }
    renderTemplate(true); byId("copy-template").focus();
  };
}
function openTemplates(id) {
  templateSelect.value = String(id);
  renderTemplate(false);
  byId("templates-dialog").showModal();
}
templateSelect.onchange = () => renderTemplate(false);
byId("open-templates").onclick = () => openTemplates(selectedTopic.id);
byId("open-resources").onclick = () => byId("resources-dialog").showModal();

function outsideDialog(dialog, event) {
  if (event.target !== dialog) return false;
  const r = dialog.getBoundingClientRect();
  return event.clientX < r.left || event.clientX > r.right ||
    event.clientY < r.top || event.clientY > r.bottom;
}
for (const id of ["search-dialog", "backup-dialog", "templates-dialog", "resources-dialog"]) {
  const dialog = byId(id);
  let startedOutside = false;
  dialog.addEventListener("pointerdown", event => { startedOutside = outsideDialog(dialog,event); });
  dialog.addEventListener("click", event => {
    if (startedOutside && outsideDialog(dialog,event)) dialog.close();
    startedOutside = false;
  });
}
byId("backup").onclick = () => byId("backup-dialog").showModal();
byId("export").onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version:1,progress:db},null,2)],{type:"application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = "ccc-practice-progress.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
};
byId("import").onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  const status = byId("backup-status");
  try {
    const backup = JSON.parse(await file.text());
    if (backup.version !== 1 || !backup.progress || typeof backup.progress !== "object" || Array.isArray(backup.progress)) throw Error();
    const imported = {};
    for (const [id,r] of Object.entries(backup.progress)) {
      if (!Object.hasOwn(problems,id) || !r || !Number.isInteger(r.score) || r.score < 0 || r.score > 10 ||
        ![0,1,2].includes(r.level) || ![0,1,2,3].includes(r.hints) || !Array.isArray(r.events) ||
        typeof r.note !== "string" || typeof r.done !== "boolean" || !Number.isFinite(r.due) ||
        r.events.some(a => !a || typeof a.label !== "string" || !Number.isFinite(a.at) || !Number.isInteger(a.gain))) throw Error();
      if (!db[id]) imported[id] = r;
    }
    db = {...db,...imported};
    save(); renderTop(); renderList(); renderLedger(); renderSheet();
    status.textContent = "导入 " + Object.keys(imported).length + " 道题的进度。当前已有的记录继续保留。";
  } catch { status.textContent = "无法读取这份备份。请选择本网站导出的 JSON 文件。"; }
  e.target.value = "";
};
renderTop(); renderList(); renderHead(); renderSheet(); renderLedger();