/* 大纲转手写笔记 —— 工作台逻辑 */
(function () {
  const R = window.NoteRender;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const STORE_KEY = 'handnote_state_v2';

  const DEFAULT_STYLE = {
    layout: 'sketch', paper: 'blank', palette: 'mine', brush: 'pencil', brushWidth: 2, jitter: 1,
    font: 'xiaolai', headFont: 'marker', localFont: '', weight: 500, inkOpacity: 0.94, hlStyle: 'solid', pageSize: 'a4',
    fontScale: 1, numbering: 'circle', autoIcon: true, flowBox: true, showHead: true, showFoot: true, custom: null, exportRatio: 2, seedBump: 0,
  };

  // ---------- 数据 ----------
  function normalizeDoc(d) {
    const doc = clone(d);
    doc.id = doc.id || uid();
    doc.title = doc.title || '';
    doc.subtitle = doc.subtitle || '';
    doc.author = doc.author || '';
    doc.footer = doc.footer || '';
    doc.chapters = (doc.chapters || []).map((c) => ({
      id: c.id || uid(), title: c.title || '', cols: c.cols || 1, span: c.span || 'half', collapsed: !!c.collapsed,
      items: (c.items || []).map((it) => (typeof it === 'string' ? { id: uid(), text: it } : { id: it.id || uid(), text: it.text || '' })),
    }));
    doc.style = Object.assign({}, DEFAULT_STYLE, doc.style || {});
    doc.updated = doc.updated || Date.now();
    return doc;
  }
  function docFromSample(s) { return normalizeDoc(Object.assign({}, s.doc, { style: s.style })); }

  let state;
  try { state = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { state = null; }
  if (!state || !state.docs || !state.docs.length) {
    const docs = NOTE_SAMPLES.map(docFromSample);
    state = { docs, activeId: docs[0].id, zoom: 'fit' };
  }
  state.docs = state.docs.map(normalizeDoc);
  if (!state.docs.find((d) => d.id === state.activeId)) state.activeId = state.docs[0].id;
  const cur = () => state.docs.find((d) => d.id === state.activeId);
  let ui = { selItem: null, editingOutline: null, activeChap: null };

  // ---------- 保存 / 历史 ----------
  let saveTimer = null;
  function save() {
    $('#saveState').textContent = '● 保存中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        const t = new Date();
        $('#saveState').textContent = `○ 已保存 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      } catch (e) { $('#saveState').textContent = '⚠ 保存失败（存储已满）'; }
    }, 300);
  }
  let undoStack = [], redoStack = [], lastSnap = JSON.stringify(cur()), histTimer = null;
  function commit(opts = {}) {
    cur().updated = Date.now();
    save();
    clearTimeout(histTimer);
    const push = () => {
      const s = JSON.stringify(cur());
      if (s !== lastSnap) { undoStack.push(lastSnap); if (undoStack.length > 120) undoStack.shift(); lastSnap = s; redoStack = []; }
      updateUndoBtns();
    };
    if (opts.now) push(); else histTimer = setTimeout(push, 500);
  }
  function resetHistory() { undoStack = []; redoStack = []; lastSnap = JSON.stringify(cur()); updateUndoBtns(); }
  function restore(snap) {
    const d = normalizeDoc(JSON.parse(snap));
    const i = state.docs.findIndex((x) => x.id === d.id);
    if (i >= 0) state.docs[i] = d; else { state.docs.push(d); }
    state.activeId = d.id;
    lastSnap = snap;
    closeEditor(); save(); renderAll();
  }
  function undo() { clearTimeout(histTimer); const s = JSON.stringify(cur()); if (s !== lastSnap) { undoStack.push(lastSnap); lastSnap = s; } if (!undoStack.length) return; redoStack.push(lastSnap); restore(undoStack.pop()); updateUndoBtns(); }
  function redo() { if (!redoStack.length) return; undoStack.push(lastSnap); restore(redoStack.pop()); updateUndoBtns(); }
  function updateUndoBtns() { $('#undoBtn').disabled = !undoStack.length && JSON.stringify(cur()) === lastSnap; $('#redoBtn').disabled = !redoStack.length; }

  // ---------- 提示 ----------
  let toastTimer;
  function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }

  // ---------- 画布渲染 ----------
  const page = $('#page');
  let renderToken = 0, renderTimer = null;
  function scheduleRender(delay = 140) { clearTimeout(renderTimer); renderTimer = setTimeout(renderCanvas, delay); }
  async function renderCanvas() {
    const tok = ++renderToken;
    const doc = cur();
    page.style.transform = '';
    const res = await R.render(page, doc, doc.style, { editing: true });
    if (tok !== renderToken) return;
    if (ui.selItem) { const el = page.querySelector(`.item[data-id="${ui.selItem}"]`); if (el) el.classList.add('sel'); }
    applyZoom();
    $('#pageInfo').textContent = `${R.SIZES[doc.style.pageSize].name} · 字号 ${res.fontSize.toFixed(0)}px`;
    $('#canvasHint').textContent = res.overflow ? '⚠ 内容太多，固定尺寸已缩到最小字号仍放不下，建议改用长图或「批量生成」拆页' : '点击纸面上任意段落即可编辑';
  }
  function applyZoom() {
    const holder = $('#pageHolder');
    const avail = $('#canvasScroll').clientWidth - 56;
    let z = state.zoom === 'fit' || !state.zoom ? Math.min(1, avail / page.offsetWidth) : state.zoom;
    z = Math.max(0.25, Math.min(2, z));
    page.style.transformOrigin = 'top left';
    page.style.transform = `scale(${z})`;
    holder.style.width = page.offsetWidth * z + 'px';
    holder.style.height = page.offsetHeight * z + 'px';
    $('#zoomVal').textContent = Math.round(z * 100) + '%';
    ui.zoom = z;
  }
  window.addEventListener('resize', () => { applyZoom(); });
  $('#zoomIn').onclick = () => { state.zoom = Math.min(2, (ui.zoom || 1) + 0.1); applyZoom(); save(); reRenderOverlaySoon(); };
  $('#zoomOut').onclick = () => { state.zoom = Math.max(0.25, (ui.zoom || 1) - 0.1); applyZoom(); save(); reRenderOverlaySoon(); };
  $('#zoomFit').onclick = () => { state.zoom = 'fit'; applyZoom(); save(); };
  function reRenderOverlaySoon() { /* 覆盖层按页面坐标绘制，缩放不影响 */ }
  $('#reseedBtn').onclick = () => { cur().style.seedBump = (cur().style.seedBump || 0) + 1; commit(); scheduleRender(0); };

  // ---------- 浮动编辑器 ----------
  const fe = $('#floatEditor'), feText = $('#feText');
  let feTarget = null; // {kind:'item', id} | {kind:'field', field}
  const FIELD_LABEL = { title: '笔记标题', subtitle: '副标题 / 核心原则（红字）', author: '署名（右上小字）', footer: '页脚说明' };
  function findItem(id) { for (const c of cur().chapters) { const it = c.items.find((x) => x.id === id); if (it) return { chap: c, item: it }; } return null; }
  function openEditor(target, anchor) {
    feTarget = target;
    const scroll = $('#canvasScroll');
    if (target.kind === 'item') {
      const f = findItem(target.id); if (!f) return;
      feText.value = f.item.text;
      $('#feLabel').textContent = `编辑段落 · ${f.chap.title || '未命名章节'}`;
      $('#feDelete').style.display = '';
      selectItem(target.id, false);
    } else {
      feText.value = cur()[target.field] || '';
      $('#feLabel').textContent = FIELD_LABEL[target.field] || '编辑';
      $('#feDelete').style.display = 'none';
    }
    const ar = anchor.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
    let top = ar.bottom - sr.top + scroll.scrollTop + 10;
    let left = ar.left - sr.left + scroll.scrollLeft;
    const maxLeft = scroll.scrollLeft + scroll.clientWidth - 456;
    left = Math.max(scroll.scrollLeft + 8, Math.min(left, maxLeft));
    fe.style.top = top + 'px'; fe.style.left = left + 'px';
    fe.classList.add('open');
    autoSize(feText);
    setTimeout(() => { feText.focus(); }, 0);
  }
  function closeEditor() { fe.classList.remove('open'); feTarget = null; }
  feText.addEventListener('input', () => {
    if (!feTarget) return;
    if (feTarget.kind === 'item') {
      const f = findItem(feTarget.id); if (!f) return;
      f.item.text = feText.value;
      const t = $(`.ol-item[data-id="${feTarget.id}"] .ol-item-text`); if (t) t.textContent = previewText(feText.value);
    } else {
      cur()[feTarget.field] = feText.value;
      if (feTarget.field === 'title') $('#docTitle').value = feText.value;
    }
    autoSize(feText);
    commit(); scheduleRender(220);
  });
  $('#feClose').onclick = closeEditor;
  $('#feDelete').onclick = () => { if (feTarget && feTarget.kind === 'item') { deleteItem(feTarget.id); closeEditor(); } };
  page.addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item) { openEditor({ kind: 'item', id: item.dataset.id }, item); return; }
    const fld = e.target.closest('[data-field]');
    if (fld) { openEditor({ kind: 'field', field: fld.dataset.field }, fld); return; }
    const head = e.target.closest('.chap');
    if (head) { const id = head.dataset.id; const inp = $(`.ol-chap[data-id="${id}"] .ol-chap-title`); if (inp) { inp.focus(); inp.select(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
  });
  document.addEventListener('mousedown', (e) => {
    if (fe.classList.contains('open') && !fe.contains(e.target) && !e.target.closest('#page')) closeEditor();
  });

  // 语法按钮
  const TOOLS = [
    { l: '黄高光', c: 't-hy', w: ['**', '**'] }, { l: '红高光', c: 't-hr', w: ['==', '=='] },
    { l: '红字', c: 't-r', w: ['!!', '!!'] }, { l: '蓝字', c: 't-b', w: ['^^', '^^'] },
    { l: '波浪线', w: ['__', '__'] }, { l: '圈注', w: ['((', '))'] },
    { l: '→', ins: ' -> ' }, { l: '↔', ins: ' <-> ' }, { l: '⇒ 红', ins: ' => ' }, { l: '长→', ins: ' --> ' },
    { l: '列表', pre: '- ' }, { l: '编号', pre: '1. ' }, { l: '蓝色注释', pre: '> ' }, { l: '小标题', pre: '### ' },
    { l: '表格', ins: '\n| 列一 | 列二 | 列三 |\n| 内容 | 内容 | 内容 |\n' },
    { l: '圆角框', w: ['[[', ']]'] }, { l: '流程框', pre: '>> ' }, { l: '图标 ▾', toggle: true },
    ...R.ICON_KEYS.map((k) => ({ l: k, ins: `[${k}]`, icon: true })),
  ];
  function applyTool(ta, t) {
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    let nv, ns, ne;
    if (t.w) { const sel = v.slice(s, e) || '文字'; nv = v.slice(0, s) + t.w[0] + sel + t.w[1] + v.slice(e); ns = s + t.w[0].length; ne = ns + sel.length; }
    else if (t.pre) { const ls = v.lastIndexOf('\n', s - 1) + 1; nv = v.slice(0, ls) + t.pre + v.slice(ls); ns = ne = e + t.pre.length; }
    else { nv = v.slice(0, s) + t.ins + v.slice(e); ns = ne = s + t.ins.length; }
    ta.value = nv; ta.focus(); ta.setSelectionRange(ns, ne);
    ta.dispatchEvent(new Event('input'));
  }
  $$('.mk-toolbar').forEach((bar) => {
    const ta = $('#' + bar.dataset.target);
    TOOLS.forEach((t) => { const b = document.createElement('button'); b.textContent = t.l; if (t.c) b.className = t.c; if (t.icon) { b.className = 'icb'; b.title = '插入图标'; } if (t.toggle) { b.onmousedown = (ev) => ev.preventDefault(); b.onclick = () => bar.classList.toggle('show-ic'); bar.appendChild(b); return; } b.onmousedown = (ev) => ev.preventDefault(); b.onclick = () => applyTool(ta, t); bar.appendChild(b); });
  });
  document.addEventListener('keydown', (e) => {
    const ta = e.target.tagName === 'TEXTAREA' ? e.target : null;
    const mod = e.metaKey || e.ctrlKey;
    if (ta && mod && e.key.toLowerCase() === 'b') { e.preventDefault(); applyTool(ta, TOOLS[0]); return; }
    if (e.key === 'Escape') { closeEditor(); if (ui.editingOutline) { ui.editingOutline = null; renderOutline(); } }
    const inField = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    if (!inField && mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  });
  function autoSize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(420, ta.scrollHeight + 2) + 'px'; }

  // ---------- 左侧大纲 ----------
  const ICON_GRIP = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  function previewText(t) {
    return String(t).replace(/\*\*|==|!!|\^\^|__|\(\(|\)\)|^#+\s|^>\s?/gm, '').replace(/<->/g, '↔').replace(/-->|->/g, '→').replace(/=>/g, '⇒').replace(/^\|\s*|\s*\|$/gm, '').replace(/\s*\|\s*/g, ' ｜ ');
  }
  const SPAN_NAME = { half: '半幅', full: '整幅', wide: '⅔幅', narrow: '⅓幅' };
  function renderOutline() {
    const doc = cur();
    const list = $('#outlineList');
    const scrollTop = list.scrollTop;
    list.innerHTML = '';
    doc.chapters.forEach((ch, ci) => {
      const el = document.createElement('div');
      el.className = 'ol-chap' + (ch.collapsed ? ' collapsed' : '') + (ui.activeChap === ch.id ? ' active' : '');
      el.dataset.id = ch.id;
      el.innerHTML = `
        <div class="ol-chap-row" data-drop="chap">
          <span class="handle" draggable="true" title="拖动排序">${ICON_GRIP}</span>
          <input class="ol-chap-title" value="" placeholder="章节标题">
          <button class="ol-mini span-btn" title="手账风版式中这一章占的宽度（点击切换）">${SPAN_NAME[ch.span] || '半幅'}</button>
          <button class="ol-mini col-btn" title="章节内分栏数（点击切换 1~4 栏）">${ch.cols || 1}栏</button>
          <button class="ol-mini ol-del" title="删除章节">${ICON_X}</button>
          <button class="ol-mini fold" title="折叠">${ch.collapsed ? ICON_DOWN : ICON_UP}</button>
        </div>
        <div class="ol-items"></div>`;
      const inp = $('.ol-chap-title', el);
      inp.value = ch.title;
      inp.oninput = () => { ch.title = inp.value; commit(); scheduleRender(200); };
      inp.onfocus = () => { ui.activeChap = ch.id; $$('.ol-chap').forEach((x) => x.classList.toggle('active', x.dataset.id === ch.id)); };
      $('.span-btn', el).onclick = () => { const order = ['half', 'full', 'wide', 'narrow']; ch.span = order[(order.indexOf(ch.span || 'half') + 1) % order.length]; commit({ now: true }); renderOutline(); scheduleRender(0); };
      $('.col-btn', el).onclick = () => { ch.cols = (ch.cols || 1) % 4 + 1; commit({ now: true }); renderOutline(); scheduleRender(0); };
      $('.fold', el).onclick = () => { ch.collapsed = !ch.collapsed; save(); renderOutline(); };
      $('.ol-chap-row .ol-del', el).onclick = () => {
        if (ch.items.length && !confirm(`删除章节「${ch.title}」及其 ${ch.items.length} 个段落？（可用撤销恢复）`)) return;
        doc.chapters.splice(ci, 1); commit({ now: true }); renderAll();
      };
      const itemsEl = $('.ol-items', el);
      ch.items.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'ol-item' + (ui.selItem === it.id ? ' active' : '');
        row.dataset.id = it.id; row.dataset.chap = ch.id; row.dataset.drop = 'item';
        if (ui.editingOutline === it.id) {
          row.innerHTML = `<span class="handle">${ICON_GRIP}</span><textarea spellcheck="false"></textarea>`;
          const ta = $('textarea', row); ta.value = it.text;
          ta.oninput = () => { it.text = ta.value; autoSize(ta); commit(); scheduleRender(220); };
          ta.onblur = () => { setTimeout(() => { if (ui.editingOutline === it.id) { ui.editingOutline = null; renderOutline(); } }, 120); };
          setTimeout(() => { autoSize(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
        } else {
          row.innerHTML = `<span class="handle" draggable="true" title="拖动排序">${ICON_GRIP}</span><div class="ol-item-text"></div><button class="ol-mini ol-del" title="删除段落">${ICON_X}</button>`;
          $('.ol-item-text', row).textContent = previewText(it.text) || '（空段落）';
          $('.ol-item-text', row).onclick = () => { ui.editingOutline = it.id; selectItem(it.id, true); renderOutline(); };
          $('.ol-del', row).onclick = () => deleteItem(it.id);
        }
        itemsEl.appendChild(row);
      });
      const addBtn = document.createElement('button');
      addBtn.className = 'ol-add-item'; addBtn.textContent = '＋ 添加段落';
      addBtn.onclick = () => addItem(ch.id);
      itemsEl.appendChild(addBtn);
      list.appendChild(el);
    });
    list.scrollTop = scrollTop;
    const n = doc.chapters.reduce((a, c) => a + c.items.length, 0);
    $('#countText').textContent = `共 ${doc.chapters.length} 个章节，${n} 个段落`;
    $('#docTitle').value = doc.title;
    bindDnD();
  }
  function selectItem(id, scrollCanvas) {
    ui.selItem = id;
    const f = findItem(id); if (f) ui.activeChap = f.chap.id;
    $$('#page .item.sel').forEach((x) => x.classList.remove('sel'));
    const el = page.querySelector(`.item[data-id="${id}"]`);
    if (el) { el.classList.add('sel'); if (scrollCanvas) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    $$('.ol-item').forEach((x) => x.classList.toggle('active', x.dataset.id === id));
    $$('.ol-chap').forEach((x) => x.classList.toggle('active', x.dataset.id === ui.activeChap));
  }
  function addItem(chapId) {
    const doc = cur();
    let ch = doc.chapters.find((c) => c.id === chapId) || doc.chapters.find((c) => c.id === ui.activeChap) || doc.chapters[doc.chapters.length - 1];
    if (!ch) { ch = { id: uid(), title: '新章节', cols: 1, items: [] }; doc.chapters.push(ch); }
    const it = { id: uid(), text: '新的段落，点击编辑' };
    ch.items.push(it); ch.collapsed = false;
    ui.editingOutline = it.id; ui.selItem = it.id; ui.activeChap = ch.id;
    commit({ now: true }); renderOutline(); scheduleRender(0);
  }
  function deleteItem(id) {
    for (const c of cur().chapters) { const i = c.items.findIndex((x) => x.id === id); if (i >= 0) { c.items.splice(i, 1); break; } }
    if (ui.selItem === id) ui.selItem = null;
    commit({ now: true }); renderOutline(); scheduleRender(0);
  }
  $('#addItemBtn').onclick = () => addItem(ui.activeChap);
  $('#addChapBtn').onclick = () => {
    const ch = { id: uid(), title: '新章节', cols: 1, items: [{ id: uid(), text: '新的段落，点击编辑' }] };
    cur().chapters.push(ch); ui.activeChap = ch.id;
    commit({ now: true }); renderOutline(); scheduleRender(0);
    setTimeout(() => { const inp = $(`.ol-chap[data-id="${ch.id}"] .ol-chap-title`); if (inp) { inp.focus(); inp.select(); inp.scrollIntoView({ block: 'center' }); } }, 30);
  };

  // 拖拽排序
  let drag = null;
  function bindDnD() {
    $$('#outlineList .handle[draggable]').forEach((h) => {
      h.addEventListener('dragstart', (e) => {
        const item = h.closest('.ol-item');
        drag = item ? { type: 'item', id: item.dataset.id } : { type: 'chap', id: h.closest('.ol-chap').dataset.id };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', drag.id);
        const ghost = item || h.closest('.ol-chap');
        e.dataTransfer.setDragImage(ghost, 20, 14);
      });
      h.addEventListener('dragend', () => { drag = null; clearDrop(); });
    });
  }
  function clearDrop() { $$('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); }
  function dropTarget(e) {
    if (!drag) return null;
    if (drag.type === 'chap') {
      const ch = e.target.closest('.ol-chap'); if (!ch) return null;
      const r = ch.getBoundingClientRect();
      return { el: ch, id: ch.dataset.id, after: e.clientY > r.top + r.height / 2 };
    }
    const it = e.target.closest('.ol-item');
    if (it) { const r = it.getBoundingClientRect(); return { el: it, kind: 'item', id: it.dataset.id, chap: it.dataset.chap, after: e.clientY > r.top + r.height / 2 }; }
    const row = e.target.closest('.ol-chap-row');
    if (row) return { el: row, kind: 'chap', chap: row.closest('.ol-chap').dataset.id, after: true };
    return null;
  }
  const listEl = $('#outlineList');
  listEl.addEventListener('dragover', (e) => {
    const t = dropTarget(e); if (!t) return;
    e.preventDefault(); clearDrop();
    t.el.classList.add(t.after ? 'drop-after' : 'drop-before');
  });
  listEl.addEventListener('drop', (e) => {
    const t = dropTarget(e); clearDrop(); if (!t) return;
    e.preventDefault();
    const doc = cur();
    if (drag.type === 'chap') {
      if (t.id === drag.id) return;
      const from = doc.chapters.findIndex((c) => c.id === drag.id);
      const [ch] = doc.chapters.splice(from, 1);
      let to = doc.chapters.findIndex((c) => c.id === t.id) + (t.after ? 1 : 0);
      doc.chapters.splice(to, 0, ch);
    } else {
      if (t.id === drag.id) return;
      const src = findItem(drag.id); if (!src) return;
      src.chap.items.splice(src.chap.items.indexOf(src.item), 1);
      const dst = doc.chapters.find((c) => c.id === t.chap);
      if (t.kind === 'chap') { dst.items.push(src.item); dst.collapsed = false; }
      else { const i = dst.items.findIndex((x) => x.id === t.id); dst.items.splice(i + (t.after ? 1 : 0), 0, src.item); }
    }
    drag = null;
    commit({ now: true }); renderOutline(); scheduleRender(0);
  });

  // ---------- 文档管理 ----------
  $('#docTitle').oninput = (e) => { cur().title = e.target.value; commit(); scheduleRender(200); };
  $('#docsBtn').onclick = (e) => { e.stopPropagation(); renderDocsMenu(); $('#docsDropdown').classList.toggle('open'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.docs-menu')) $('#docsDropdown').classList.remove('open'); });
  function switchDoc(id) { state.activeId = id; ui = { selItem: null, editingOutline: null, activeChap: null }; closeEditor(); save(); resetHistory(); renderAll(); }
  function renderDocsMenu() {
    const dd = $('#docsDropdown');
    const docs = state.docs.slice().sort((a, b) => b.updated - a.updated);
    dd.innerHTML = '<div style="font-size:12px;color:#8a8f99;padding:4px 10px">我的笔记</div>' + docs.map((d) => `<div class="dd-item ${d.id === state.activeId ? 'active' : ''}" data-id="${d.id}"><span>${escapeHTML(plainTitle(d.title) || '未命名笔记')}</span>${state.docs.length > 1 ? `<button class="dd-del" data-del="${d.id}" title="删除">✕</button>` : ''}</div>`).join('') +
      '<div class="dd-sep"></div><div class="dd-item" data-act="new">＋ 新建空白笔记</div><div class="dd-item" data-act="dup">⧉ 复制当前笔记</div>' +
      NOTE_SAMPLES.map((s, i) => `<div class="dd-item" data-sample="${i}">↺ 载入${escapeHTML(s.name)}</div>`).join('');
    dd.onclick = (e) => {
      e.stopPropagation();
      const del = e.target.closest('[data-del]');
      if (del) { const d = state.docs.find((x) => x.id === del.dataset.del); if (confirm(`删除笔记「${d.title}」？此操作不能撤销。`)) { state.docs = state.docs.filter((x) => x.id !== d.id); if (state.activeId === d.id) state.activeId = state.docs[0].id; switchDoc(state.activeId); } dd.classList.remove('open'); return; }
      const it = e.target.closest('.dd-item'); if (!it) return;
      dd.classList.remove('open');
      if (it.dataset.id) return switchDoc(it.dataset.id);
      if (it.dataset.act === 'new') { const d = normalizeDoc({ title: '新的笔记', subtitle: '', chapters: [{ title: '第一章', items: ['在这里写下要点 -> 结果', '用 **黄色高光** 标出重点'] }], style: Object.assign({}, cur().style, { seedBump: 0 }) }); state.docs.push(d); return switchDoc(d.id); }
      if (it.dataset.act === 'dup') { const d = normalizeDoc(Object.assign(clone(cur()), { id: uid(), title: cur().title + '（副本）', updated: Date.now() })); state.docs.push(d); return switchDoc(d.id); }
      if (it.dataset.sample != null) { const d = docFromSample(NOTE_SAMPLES[+it.dataset.sample]); state.docs.push(d); return switchDoc(d.id); }
    };
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------- Markdown 导入 / 导出 ----------
  function parseMarkdown(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const doc = { title: '', subtitle: '', author: '', footer: '', chapters: [] };
    let chap = null, buf = [], mode = null;
    const conv = (s) => s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1^^$2^^').replace(/~~(.+?)~~/g, '__$1__').replace(/`([^`]+)`/g, '!!$1!!');
    const flush = () => {
      while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
      while (buf.length && !buf[0].trim()) buf.shift();
      if (buf.length) {
        if (!chap) { chap = { title: '要点', cols: 1, items: [] }; doc.chapters.push(chap); }
        chap.items.push(conv(buf.join('\n')));
      }
      buf = []; mode = null;
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      let m;
      if ((m = line.match(/^#\s+(.*)/))) { if (!doc.title) { doc.title = m[1].trim(); continue; } flush(); chap = { title: conv(m[1].trim()), cols: 1, items: [] }; doc.chapters.push(chap); continue; }
      if (!chap && !doc.subtitle && doc.title && /^>\s?/.test(line) && !buf.length) { doc.subtitle = conv(line.replace(/^>\s?/, '')); continue; }
      if ((m = line.match(/^##\s+(.*)/))) { flush(); chap = { title: conv(m[1].trim()), cols: 1, items: [] }; doc.chapters.push(chap); continue; }
      if ((m = line.match(/^#{3,6}\s+(.*)/))) { flush(); buf = ['### ' + m[1].trim()]; mode = 'h3'; continue; }
      if (/^\s*$/.test(line)) { if (mode === 'h3' || mode === 'table') buf.push(''); else flush(); continue; }
      if (/^[-*+]\s+/.test(line) || /^\d+[.)、]\s+/.test(line)) {
        if (mode === 'h3') { buf.push(line.replace(/^[-*+]\s+/, '- ')); continue; }
        flush(); buf = [line.replace(/^[-*+]\s+/, '')]; mode = 'list'; continue;
      }
      if (/^\s+\S/.test(line)) { if (!buf.length) mode = 'para'; buf.push(line.replace(/^(\s+)[-*+]\s+/, '$1- ')); continue; }
      if (/^\s*\|/.test(line)) { if (mode !== 'table' && mode !== 'h3' && mode !== 'para') flush(); if (mode !== 'h3' && mode !== 'para') mode = 'table'; buf.push(line); continue; }
      if (mode === 'list') flush();
      if (!mode) mode = 'para';
      buf.push(line);
    }
    flush();
    if (!doc.title) doc.title = '导入的笔记';
    return doc;
  }
  function toMarkdown(doc) {
    let s = `# ${doc.title}\n`;
    if (doc.subtitle) s += `> ${doc.subtitle}\n`;
    s += '\n';
    if (doc.author) s += `署名：${doc.author}\n\n`;
    for (const c of doc.chapters) {
      s += `## ${c.title}\n\n`;
      for (const it of c.items) s += it.text.trim() + '\n\n';
    }
    if (doc.footer) s += `---\n\n${doc.footer}\n`;
    return s;
  }
  function openModal(id) { $('#' + id).classList.add('open'); }
  $$('.modal-mask').forEach((m) => { m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('open'); }); });
  $('#importMdBtn').onclick = () => openModal('mdModal');
  $('#mdFile').onchange = async (e) => { const f = e.target.files[0]; if (f) $('#mdInput').value = await f.text(); e.target.value = ''; };
  $('#mdImportGo').onclick = () => {
    const md = $('#mdInput').value.trim();
    if (!md) return toast('请先粘贴或选择 Markdown 内容');
    const parsed = parseMarkdown(md);
    const mode = ($('input[name=mdMode]:checked') || {}).value || 'new';
    if (mode === 'new') {
      const d = normalizeDoc(Object.assign(parsed, { style: Object.assign({}, cur().style, { seedBump: 0 }) }));
      state.docs.push(d); switchDoc(d.id);
    } else if (mode === 'replace') {
      const d = normalizeDoc(Object.assign(parsed, { id: cur().id, style: cur().style }));
      state.docs[state.docs.findIndex((x) => x.id === cur().id)] = d; commit({ now: true }); renderAll();
    } else {
      const add = normalizeDoc(parsed); cur().chapters.push(...add.chapters); commit({ now: true }); renderAll();
    }
    $('#mdModal').classList.remove('open');
    const n = parsed.chapters.reduce((a, c) => a + c.items.length, 0);
    toast(`已导入 ${parsed.chapters.length} 个章节、${n} 个段落`);
  };
  $('#exportMdBtn').onclick = () => {
    const blob = new Blob([toMarkdown(cur())], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, safeName(cur().title) + '.md');
  };

  // ---------- 导出 PNG ----------
  const fontCssCache = {};
  async function fontCSS(style) {
    const a = await oneFontCSS(R.resolveFont(style));
    const h = R.resolveHeadFont(style);
    const b = h.file && h.file !== R.resolveFont(style).file ? await oneFontCSS(h) : '';
    return a + b;
  }
  async function oneFontCSS(f) {
    if (!f.file) return '';
    if (fontCssCache[f.file]) return fontCssCache[f.file];
    const blob = await (await fetch(f.file)).blob();
    const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    return (fontCssCache[f.file] = `@font-face{font-family:"${f.family}";src:url(${dataUrl.replace('application/octet-stream', 'font/woff2')}) format("woff2");}`);
  }
  async function renderToBlob(doc, style, ratio) {
    const host = $('#offscreen');
    host.innerHTML = '';
    const pg = document.createElement('div');
    host.appendChild(pg);
    await R.render(pg, doc, style, { editing: false, freeze: true });
    const css = await fontCSS(style);
    const paper = R.PAPERS.find((p) => p.id === style.paper) || R.PAPERS[0];
    const opts = { pixelRatio: ratio, fontEmbedCSS: css, cacheBust: false, width: pg.offsetWidth, height: pg.offsetHeight, backgroundColor: paper.bg };
    // 首次调用偶尔字体未就绪，先预热一次
    await htmlToImage.toCanvas(pg, Object.assign({}, opts, { pixelRatio: 0.2 }));
    const blob = await htmlToImage.toBlob(pg, opts);
    host.innerHTML = '';
    return blob;
  }
  function plainTitle(s) { return String(s || '').replace(/\*\*|==|!!|\^\^|__|\(\(|\)\)|\[\[|\]\]/g, ''); }
  function safeName(s) { s = plainTitle(s); return (s || '手写笔记').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60); }
  function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  $('#exportPngBtn').onclick = async () => {
    const btn = $('#exportPngBtn'); btn.disabled = true;
    toast('正在生成高清 PNG…', 60000);
    try {
      const doc = cur();
      const blob = await renderToBlob(doc, doc.style, doc.style.exportRatio || 2);
      downloadBlob(blob, safeName(doc.title) + '.png');
      toast(`已导出 PNG（${(blob.size / 1024 / 1024).toFixed(1)} MB）`);
    } catch (e) { console.error(e); toast('导出失败：' + (e.message || e)); }
    btn.disabled = false;
  };

  // ---------- 批量生成 ----------
  let batchBlobs = [];
  $('#batchBtn').onclick = () => { openModal('batchModal'); };
  $('#batchGo').onclick = async () => {
    const doc = cur();
    const split = $('#bSplit').value, size = $('#bSize').value, ratio = +$('#bRatio').value;
    const withCover = $('#bCover').checked, withNo = $('#bPageNo').checked;
    const groups = [];
    if (split === 'all') groups.push(doc.chapters);
    else { const n = +split; for (let i = 0; i < doc.chapters.length; i += n) groups.push(doc.chapters.slice(i, i + n)); }
    const cards = [];
    if (withCover && split !== 'all') {
      cards.push({ name: '00_封面', doc: Object.assign(clone(doc), { chapters: [{ id: 'cover', title: '本篇目录', cols: 1, items: [{ id: 'ci', text: doc.chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n') }] }], footer: '' }), cover: true });
    }
    groups.forEach((g, i) => {
      const startIdx = doc.chapters.indexOf(g[0]);
      cards.push({ name: String(cards.length + (withCover ? 0 : 1)).padStart(2, '0') + '_' + safeName(g.map((c) => c.title).join('+')).slice(0, 30), doc: Object.assign(clone(doc), { chapters: clone(g) }), startIdx });
    });
    const total = cards.length;
    const grid = $('#batchGrid'); grid.innerHTML = '';
    batchBlobs = [];
    $('#batchGo').disabled = true; $('#batchZip').disabled = true;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      $('#batchStatus').textContent = `正在生成 ${i + 1} / ${total}…`;
      const st = Object.assign({}, doc.style, { pageSize: size });
      if (!c.cover) {
        if (i > 0 || withCover) { c.doc.subtitle = ''; c.doc.author = c.doc.author; }
        c.doc.footer = (withNo ? `${i + 1} / ${total}　` : '') + (i === total - 1 ? doc.footer : '');
        // 保持原文中的章节编号
        if (st.numbering !== 'none' && st.layout === 'class') st._numOffset = c.startIdx;
        if (st.layout === 'sketch') st._numStart = R.countNumbered(doc.chapters.slice(0, c.startIdx));
      } else if (withNo) c.doc.footer = `1 / ${total}`;
      if (c.startIdx) c.doc.chapters = c.doc.chapters; // 编号偏移
      try {
        const blob = await renderToBlob(applyNumOffset(c.doc, st), st, ratio);
        batchBlobs.push({ name: c.name + '.png', blob });
        const url = URL.createObjectURL(blob);
        const card = document.createElement('div'); card.className = 'batch-card';
        card.innerHTML = `<img src="${url}"><div><span>${escapeHTML(c.name)}</span><a href="${url}" download="${escapeHTML(c.name)}.png">下载</a></div>`;
        grid.appendChild(card);
      } catch (e) { console.error(e); toast('第 ' + (i + 1) + ' 张生成失败'); }
    }
    $('#batchStatus').textContent = `已生成 ${batchBlobs.length} 张卡片`;
    $('#batchGo').disabled = false; $('#batchZip').disabled = !batchBlobs.length;
  };
  function applyNumOffset(doc, st) {
    // 拆页后章节编号接着原文继续（如第二张从“三、”开始）
    const off = st._numOffset || 0;
    if (!off || st.layout !== 'class' || st.numbering === 'none') return doc;
    const d = clone(doc);
    const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
    const CIR = '⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
    d.chapters.forEach((c, i) => { const n = off + i + 1; c.title = (st.numbering === 'num' ? `${n}. ` : st.numbering === 'circle' ? `${CIR[n]} ` : `${CN[n] || n}、`) + c.title; });
    st.numbering = 'none';
    return d;
  }
  $('#batchZip').onclick = async () => {
    const zip = new JSZip();
    batchBlobs.forEach((b) => zip.file(b.name, b.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, safeName(cur().title) + '_卡片.zip');
  };

  // ---------- 语法帮助 ----------
  const SYNTAX = [
    ['**重点**', '黄色马克笔高光'], ['==提醒==', '红色高光（少量关键提醒）'], ['!!批注!!', '红笔字'], ['^^解释^^', '蓝笔字（逻辑、因果）'],
    ['__强调__', '红色波浪下划线'], ['((圈起来))', '红笔圈注'], ['A -> B', '蓝色手绘箭头（也可写 →）'], ['A <-> B', '双向箭头'], ['A => B', '红色粗箭头'], ['A --> B', '长箭头'],
    ['[[探索非洲]]', '圆角框'], ['>> A -> B -> C', '流程方框串联（3 段以上的短流程会自动画框）'],
    ['- 要点', '列表（蓝色圆点）'], ['1. 步骤', '圈号 ①②③'], ['> 注释', '一整行蓝色小字注释'], ['### 小标题', '段落内小标题（带蓝色下划线）'],
    ['| 列一 | 列二 |\n| 内容 | 内容 |', '手绘表格，第一行自动高光'], [R.ICON_KEYS.map((k) => `[${k}]`).join(' ').replace(/((?:\S+ ){6})/g, '$1\n'), '简笔图标（章节标题会按关键词自动配图，也可手动插入）'],
    ['章节标题以 A. / B. / ① 开头', '手账风中不再自动编号'], ['章节标题留空', '只显示内容，不显示标题（适合开篇导语）'],
    ['行首空两格', '缩进一级'], ['⌘B', '编辑时给选中文字加黄色高光'],
  ];
  $('#syntaxTable').innerHTML = SYNTAX.map((r) => `<tr><td><code>${escapeHTML(r[0])}</code></td><td>${r[1]}</td></tr>`).join('');
  $('#syntaxBtn').onclick = () => openModal('syntaxModal');

  // ---------- 右侧样式面板 ----------
  function rgbaToHex(c) {
    if (!c) return '#000000';
    if (c[0] === '#') return c;
    const m = c.match(/[\d.]+/g); if (!m) return '#000000';
    return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
  }
  const LAYOUT_ICONS = {
    sketch: '<svg class="layout-thumb" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="24" height="26" rx="2"/><path d="M8 8h16M16 12v13M7 18.5h18"/><circle cx="10.5" cy="14.5" r="1.6"/><path d="M19 14h5M8.5 22h4"/></svg>',
    class: '<svg class="layout-thumb" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="5" width="18" height="22" rx="2"/><path d="M11 5v22M14 11h7M14 15h7M14 19h5"/></svg>',
    sop: '<svg class="layout-thumb" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="2.5"/><circle cx="9" cy="16" r="2.5"/><circle cx="9" cy="24" r="2.5"/><path d="M15 8h11M15 16h11M15 24h8"/></svg>',
    mind: '<svg class="layout-thumb" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="13" width="8" height="6" rx="1.5"/><rect x="21" y="5" width="8" height="5" rx="1.5"/><rect x="21" y="22" width="8" height="5" rx="1.5"/><path d="M11 16h4v-8.5h6M15 16v8.5h6"/></svg>',
  };
  function paperThumbStyle(p) {
    let bg = p.bg, img = '', size = '';
    if (p.kind === 'ruled') { img = `linear-gradient(to bottom, transparent 9px, ${p.line} 9px, ${p.line} 10px)`; size = '100% 10px'; }
    if (p.kind === 'grid') { img = `linear-gradient(${p.line} 1px, transparent 1px), linear-gradient(90deg, ${p.line} 1px, transparent 1px)`; size = '10px 10px'; }
    if (p.kind === 'dot') { img = `radial-gradient(${p.line} 1px, transparent 1.2px)`; size = '8px 8px'; }
    return `background:${bg};${img ? `background-image:${img};background-size:${size};` : ''}`;
  }
  function buildSettings() {
    const st = cur().style;
    const pal = R.resolvePalette(st);
    const el = $('#settings');
    const choice = (key, val, inner, label, sub) => `<button class="choice ${st[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}">${inner}<span>${label}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</button>`;
    el.innerHTML = `
      <div class="set-sec"><div class="set-title">版式布局</div>
        <div class="choice-grid c2" style="margin-bottom:8px">${choice('layout', 'sketch', LAYOUT_ICONS.sketch, '我的手账风', 'A4 拼版 · 简笔配图')}</div>
        <div class="choice-grid">${choice('layout', 'class', LAYOUT_ICONS.class, '课堂笔记')}${choice('layout', 'sop', LAYOUT_ICONS.sop, 'SOP 长图')}${choice('layout', 'mind', LAYOUT_ICONS.mind, '思维导图')}</div>
        <div class="toggle-row">按关键词自动配简笔图标<label class="switch"><input type="checkbox" data-check="autoIcon" ${st.autoIcon !== false ? 'checked' : ''}><span></span></label></div>
        <div class="toggle-row">短流程自动画成方框<label class="switch"><input type="checkbox" data-check="flowBox" ${st.flowBox ? 'checked' : ''}><span></span></label></div>
        <div class="set-sub">页面尺寸</div>
        <div class="choice-grid c4">${Object.entries(R.SIZES).map(([k, v]) => choice('pageSize', k, '', v.name)).join('')}</div>
        <div class="hint">固定尺寸会自动缩小字号塞进一页；内容多时用「批量生成」按章节拆成多张。</div>
      </div>
      <div class="set-sec"><div class="set-title">纸张选择</div>
        <div class="choice-grid">${R.PAPERS.map((p) => choice('paper', p.id, `<div class="paper-thumb" style="${paperThumbStyle(p)}"></div>`, p.name)).join('')}</div>
      </div>
      <div class="set-sec"><div class="set-title">墨水配色</div>
        <div class="choice-grid c4">${R.PALETTES.map((p) => choice('palette', p.id, `<div class="swatches"><i style="background:${p.red}"></i><i style="background:${p.blue}"></i><i style="background:${p.text}"></i><i style="background:${rgbaToHex(p.hy)}"></i></div>`, p.name)).join('')}</div>
        <div class="set-sub"><span>自定义颜色</span><a href="#" id="resetColors" style="color:var(--ui-primary);text-decoration:none;font-size:12px">恢复配色默认</a></div>
        <div class="color-row">
          ${[['text', '正文'], ['red', '批注'], ['blue', '逻辑'], ['hy', '高光'], ['head', '标题底']].map(([k, n]) => `<label><input type="color" data-color="${k}" value="${rgbaToHex(pal[k])}">${n}</label>`).join('')}
        </div>
      </div>
      <div class="set-sec"><div class="set-title">线段与箭头</div>
        <div class="choice-grid">${[['pencil', '铅笔'], ['marker', '马克笔'], ['chalk', '粉笔']].map(([v, n]) => choice('brush', v, `<svg class="brush-thumb" data-brush="${v}" viewBox="0 0 100 26"></svg>`, n)).join('')}</div>
        <div class="set-sub"><span>笔刷粗细</span><span>${(+st.brushWidth).toFixed(1)}</span></div>
        <input type="range" min="0.6" max="5" step="0.1" value="${st.brushWidth}" data-range="brushWidth">
        <div class="set-sub"><span>手绘抖动</span><span>${(+st.jitter).toFixed(1)}</span></div>
        <input type="range" min="0" max="3" step="0.1" value="${st.jitter}" data-range="jitter">
        <div class="set-sub">高光样式</div>
        <div class="choice-grid c2">${choice('hlStyle', 'solid', '', '实心马克笔')}${choice('hlStyle', 'hachure', '', '斜线排笔')}</div>
      </div>
      <div class="set-sec"><div class="set-title">手写字体</div>
        <div class="set-sub" style="margin-top:0">正文字体</div>
        <select class="set-select" data-select="font">${R.FONTS.map((f) => `<option value="${f.id}" ${st.font === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}</select>
        ${st.font === 'local' ? `<input class="set-input" style="margin-top:8px" data-text="localFont" placeholder="输入本机字体名，如：平方时光体" value="${escapeHTML(st.localFont || '')}"><div class="hint">填写已安装在电脑上的字体名称（如 平方时光体、Kaiti SC）。</div>` : ''}
        <div class="set-sub">标题字体</div>
        <select class="set-select" data-select="headFont"><option value="same" ${st.headFont === 'same' ? 'selected' : ''}>与正文相同</option>${R.FONTS.filter((f) => f.file).map((f) => `<option value="${f.id}" ${st.headFont === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}</select>
        <div class="set-sub"><span>字体粗细</span><span>${st.weight}</span></div>
        <div class="choice-grid c4">${[[400, '常规'], [500, '稍粗'], [600, '加粗'], [700, '特粗']].map(([v, n]) => choice('weight', v, `<span style="font-size:15px">${v}</span>`, '', n)).join('')}</div>
        <div class="set-sub"><span>字号</span><span>${Math.round(st.fontScale * 100)}%</span></div>
        <input type="range" min="0.7" max="1.45" step="0.01" value="${st.fontScale}" data-range="fontScale">
        <div class="set-sub"><span>笔迹浓淡</span><span>${Math.round(st.inkOpacity * 100)}</span></div>
        <input type="range" min="0.45" max="1" step="0.01" value="${st.inkOpacity}" data-range="inkOpacity">
      </div>
      <div class="set-sec"><div class="set-title">其他</div>
        <div class="set-sub">章节编号</div>
        <div class="choice-grid c4">${[['cn', '一、'], ['num', '1.'], ['circle', '①'], ['none', '无']].map(([v, n]) => choice('numbering', v, '', n)).join('')}</div>
        <div class="toggle-row">显示标题区<label class="switch"><input type="checkbox" data-check="showHead" ${st.showHead ? 'checked' : ''}><span></span></label></div>
        <div class="toggle-row">显示页脚<label class="switch"><input type="checkbox" data-check="showFoot" ${st.showFoot ? 'checked' : ''}><span></span></label></div>
        <div class="set-sub">导出清晰度</div>
        <div class="choice-grid">${[[1.5, '1.5 倍'], [2, '2 倍'], [3, '3 倍']].map(([v, n]) => choice('exportRatio', v, '', n)).join('')}</div>
      </div>`;
    // 笔刷预览
    $$('.brush-thumb', el).forEach((svg) => {
      const rc = rough.svg(svg); const b = svg.dataset.brush;
      const o = b === 'marker' ? { roughness: 0.4, strokeWidth: 5, disableMultiStroke: true } : b === 'chalk' ? { roughness: 2.2, strokeWidth: 3.2 } : { roughness: 1, strokeWidth: 2.2 };
      svg.appendChild(rc.line(8, 14, 92, 12, Object.assign({ stroke: '#222', seed: 3 }, o)));
    });
    $$('.choice', el).forEach((b) => b.onclick = () => {
      const k = b.dataset.k; let v = b.dataset.v;
      if (['weight', 'exportRatio'].includes(k)) v = +v;
      st[k] = v;
      if (k === 'palette') st.custom = null;
      if (k === 'layout' && v === 'sketch') { if (!st.headFont || st.headFont === 'same') st.headFont = 'marker'; if (st.pageSize === 'long') st.pageSize = 'a4'; }
      if (k === 'paper' && v === 'board' && st.palette !== 'chalk') { st.palette = 'chalk'; st.brush = 'chalk'; st.custom = null; }
      if (k === 'paper' && v !== 'board' && st.palette === 'chalk') { st.palette = 'mine'; st.custom = null; }
      commit({ now: true }); buildSettings(); scheduleRender(0);
    });
    $$('[data-range]', el).forEach((r) => {
      r.oninput = () => { st[r.dataset.range] = +r.value; r.previousElementSibling.lastElementChild.textContent = r.dataset.range === 'fontScale' || r.dataset.range === 'inkOpacity' ? Math.round(r.value * 100) + (r.dataset.range === 'fontScale' ? '%' : '') : (+r.value).toFixed(1); commit(); scheduleRender(60); };
    });
    $$('[data-select]', el).forEach((s) => s.onchange = () => { st[s.dataset.select] = s.value; commit({ now: true }); buildSettings(); scheduleRender(0); });
    $$('[data-text]', el).forEach((s) => s.oninput = () => { st[s.dataset.text] = s.value; commit(); scheduleRender(300); });
    $$('[data-check]', el).forEach((s) => s.onchange = () => { st[s.dataset.check] = s.checked; commit({ now: true }); scheduleRender(0); });
    $$('[data-color]', el).forEach((s) => s.oninput = () => { st.custom = Object.assign({}, st.custom || {}, { [s.dataset.color]: s.value }); commit(); scheduleRender(80); });
    $('#resetColors').onclick = (e) => { e.preventDefault(); st.custom = null; commit({ now: true }); buildSettings(); scheduleRender(0); };
  }

  $('#undoBtn').onclick = undo;
  $('#redoBtn').onclick = redo;

  function renderAll() { renderOutline(); buildSettings(); renderCanvas(); updateUndoBtns(); }
  renderAll();
  // 字体文件加载完成后重绘一次，保证测量准确
  document.fonts && document.fonts.ready.then(() => scheduleRender(0));
  window.__app = { state, cur, parseMarkdown, toMarkdown, renderToBlob };
})();
