/* 舍得 · 网页演示版（方案A）
 * 只读复用后端 v0/v3/v5 接口，仅实现决策流，零新增接口。
 * 身份固定为演示 openid，首次进入先调 /v0/home/info 建号。
 */
'use strict';

const OPENID = 'demouser00000000000000000000';
const BASE = location.origin; // 方式1：静态页与接口同源

// file:// 双击打开时没有后端，直接进演示模式；http 下探测失败也会自动切换
let OFFLINE = location.protocol === 'file:';

// ---------- 基础工具 ----------

function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- 自定义对话框（视觉层组件，替代原生 alert/confirm） ----------

function uiDialog(message, { okText = '好', cancelText = null, danger = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dlg-overlay';
    overlay.innerHTML =
      '<div class="dlg" role="dialog" aria-modal="true">' +
      '<div class="dlg-msg"></div>' +
      '<div class="dlg-actions"></div>' +
      '</div>';
    overlay.querySelector('.dlg-msg').textContent = message;
    const actions = overlay.querySelector('.dlg-actions');
    const close = val => {
      overlay.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 200);
      resolve(val);
    };
    if (cancelText !== null) {
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-outline btn-sm';
      cancel.textContent = cancelText;
      cancel.onclick = () => close(false);
      actions.appendChild(cancel);
    }
    const ok = document.createElement('button');
    ok.className = 'btn btn-sm ' + (danger ? 'btn-red' : 'btn-primary');
    ok.textContent = okText;
    ok.onclick = () => close(true);
    actions.appendChild(ok);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(cancelText !== null ? false : true); });
    const onKey = e => {
      if (e.key === 'Escape') close(cancelText !== null ? false : true);
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.classList.add('is-open'); ok.focus(); });
  });
}

function uiAlert(msg) { return uiDialog(msg); }
function uiConfirm(msg) { return uiDialog(msg, { okText: '继续', cancelText: '取消' }); }

async function api(path, { method = 'GET', data, formData } = {}) {
  if (OFFLINE) return window.SHEDE_OFFLINE.handle(path, { method, data, formData });

  const opts = { method };
  if (formData) {
    opts.body = formData;
  } else if (data !== undefined && method !== 'GET') {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(data);
  }
  let url = BASE + path;
  if (method === 'GET' && data) {
    const qs = new URLSearchParams(data).toString();
    url += (path.includes('?') ? '&' : '?') + qs;
  }

  let resp;
  try {
    resp = await fetch(url, opts);
  } catch (e) {
    // 网络层失败（后端没起 / 跨域被拦）→ 转演示模式，流程不中断
    OFFLINE = true;
    window.SHEDE_OFFLINE.markOffline();
    setModeHint();
    return window.SHEDE_OFFLINE.handle(path, { method, data, formData });
  }

  let body;
  try { body = await resp.json(); } catch (e) { throw new Error('服务开小差了，请稍后再试'); }
  if (!resp.ok) {
    if (resp.status >= 500) throw new Error('服务开小差了，请稍后再试');
    const detail = body.detail || body.message || '';
    // 4xx 业务错误：保留中文业务提示；英文堆栈/缺失则给兜底文案
    throw new Error(/[\u4e00-\u9fa5]/.test(detail) ? detail : '请求没有成功，请再试一次');
  }
  if (body.status === 'error') throw new Error(body.message || '这次没成功，再试一次吧');
  return body.data !== undefined ? body.data : body;
}

function setModeHint() {
  const el = document.getElementById('modeHint');
  if (!el) return;
  el.textContent = OFFLINE ? '演示模式 · 不用联网，数据只留在你这台电脑上' : 'AI 教练已就位';
  el.className = 'footer-hint' + (OFFLINE ? ' is-demo' : ' is-live');
}

function imgUrl(imageFilename) {
  if (!imageFilename) return '';
  if (OFFLINE) return window.SHEDE_OFFLINE.imgUrl(imageFilename);
  return BASE + '/Photos/' + imageFilename;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function go(hash) { location.hash = hashNormalize(hash); }
function hashNormalize(h) { return h.startsWith('#') ? h : '#' + h; }

function parseHash() {
  const h = location.hash || '#/';
  const [pathPart, queryPart] = h.slice(1).split('?');
  const params = {};
  if (queryPart) new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v; });
  return { path: pathPart || '/', params };
}

function setNav(name) {
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
}

// 跨视图状态（刷新不丢；storage 不可用时退回内存）
const store = {
  _mem: {},
  set(k, v) {
    store._mem[k] = v;
    try { sessionStorage.setItem('shede_' + k, JSON.stringify(v)); } catch (e) { /* file:// 或隐私模式 */ }
  },
  get(k) {
    try {
      const s = sessionStorage.getItem('shede_' + k);
      if (s) return JSON.parse(s);
    } catch (e) { /* ignore */ }
    return store._mem[k] !== undefined ? store._mem[k] : null;
  },
  del(k) {
    delete store._mem[k];
    try { sessionStorage.removeItem('shede_' + k); } catch (e) { /* ignore */ }
  }
};

function itemThumb(item) {
  const u = item.image_filename ? imgUrl(item.image_filename) : '';
  return u
    ? '<img class="item-thumb" src="' + esc(u) + '" alt="">'
    : '<div class="item-thumb-placeholder">物</div>';
}

function daysLeftText(item) {
  if (item.expired) return '<span class="expired">该想想了</span>';
  if (item.days_left !== undefined && item.days_left !== null) return '还剩 ' + item.days_left + ' 天';
  return '';
}

const VERDICT_TEXT = { keep: '可以放心留下', observe: '先别急着决定', dispose: '也许能说再见了' };
const STATUS_TEXT = { pending: '还没想好', observing: '冷静期中', resolved: '想清楚了' };
const DECISION_TEXT = { keep: '留下', observe: '再想想', sell: '卖掉', gift: '送人', recycle: '回收', discard: '扔掉', trash: '扔掉' };

// ---------- 视图 1：看板 ----------

async function viewHome() {
  setNav('home');
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">加载中…</div>';

  const [overview, pending, due] = await Promise.all([
    api('/v5/observe/overview', { data: { openid: OPENID } }),
    api('/v5/observe/list', { data: { openid: OPENID, status: 'pending' } }),
    api('/v5/observe/due', { data: { openid: OPENID } })
  ]);

  const dueItems = (due && due.items) || [];
  const badge = document.getElementById('navDueBadge');
  badge.hidden = !dueItems.length;
  badge.textContent = dueItems.length;

  let html = '';
  if (dueItems.length) {
    html += '<div class="card due-card"><div class="card-title">有 ' + dueItems.length + ' 件东西的冷静期到了，回来看看它们吧</div>' +
      dueItems.map(it =>
        '<div class="item-row" onclick="go(\'#/item?item_id=' + it.item_id + '\')">' +
        itemThumb(it) +
        '<div class="item-info"><div class="item-title">' + esc(it.title) + '</div>' +
        '<div class="item-meta"><span class="expired">冷静期到了</span> · 说好看到 ' + esc(it.observe_until || '') + '</div></div>' +
        '</div>').join('') + '</div>';
  }

  html += '<div class="stats">' +
    '<div class="stat pending" data-tip="拍了照、还没做出决定的东西"><div class="stat-num">' + (overview.pending || 0) + '</div><div class="stat-label">还没想好</div></div>' +
    '<div class="stat observing" data-tip="放进观察箱、还在 30 天冷静期里的东西"><div class="stat-num">' + (overview.observing || 0) + '</div><div class="stat-label">冷静期中</div></div>' +
    '<div class="stat resolved" data-tip="已经想清楚、做出决定的东西"><div class="stat-num">' + (overview.resolved || 0) + '</div><div class="stat-label">想清楚了</div></div>' +
    '</div>';

  html += '<button class="btn btn-primary btn-block btn-lg" onclick="go(\'#/capture\')">拍一件让你纠结的东西</button>';

  const items = (pending && pending.items) || [];
  html += '<div class="card section-gap"><div class="card-title">还没想好（' + items.length + '）</div>';
  if (!items.length) {
    html += '<div class="empty">眼下没有让你纠结的东西，挺清爽的。拍一件试试？</div>';
  } else {
    html += items.map(it => {
      const target = it.ai_verdict ? '#/verdict?item_id=' + it.item_id : '#/question?item_id=' + it.item_id;
      return '<div class="item-row" onclick="go(\'' + target + '\')">' +
        itemThumb(it) +
        '<div class="item-info"><div class="item-title">' + esc(it.title) + '</div>' +
        '<div class="item-meta">' + esc(it.category || '未分类') +
        (it.ai_score != null ? ' · 我给了 ' + it.ai_score + ' 分' : '') + '</div></div>' +
        '<span class="chip chip-pending">' + (it.ai_verdict ? '看分析' : '一起想') + '</span>' +
        '</div>';
    }).join('');
  }
  html += '</div>';

  if (OFFLINE) {
    html += '<div class="section-gap">' +
      '<button class="btn btn-outline btn-block" onclick="resetDemo()">重新演示（恢复示例物品）</button></div>';
  }

  app.innerHTML = html;
}

async function resetDemo() {
  if (!await uiConfirm('会把现在的物品都清空，回到最初的几件示例。要继续吗？')) return;
  window.SHEDE_OFFLINE.reset();
  toast('示例物品回来了');
  go('#/');
  route();
}

// ---------- 视图 2：拍照识物 ----------

function viewCapture() {
  setNav('');
  document.getElementById('app').innerHTML =
    '<h2 class="page-title">从一件东西开始</h2>' +
    '<div class="card">' +
    '  <div class="upload-zone" id="uploadZone">' +
    '    <div style="font-size:32px;margin-bottom:8px;">📷</div>' +
    '    <div>拍一张（或选一张）它的照片</div>' +
    '    <div class="text-sub" style="margin-top:6px;">我会先认出它是什么，再陪你慢慢想</div>' +
    '  </div>' +
    '  <input type="file" id="fileInput" accept="image/*" hidden>' +
    (OFFLINE
      ? '  <div style="margin-top:12px;"><button class="btn btn-outline btn-block" id="btnSample">手边没照片？先用示例物品走一遍</button></div>'
      : '') +
    '</div>';

  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  zone.onclick = () => input.click();

  const sampleBtn = document.getElementById('btnSample');
  if (sampleBtn) {
    sampleBtn.onclick = async () => {
      const data = await window.SHEDE_OFFLINE.sampleCapture();
      store.set('capture', {
        image_filename: data.image_filename,
        local_preview: '',
        recognition: data.analysis_result || {}
      });
      go('#/confirm');
    };
  }

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    zone.innerHTML = '<div class="loading">我在认它了，稍等…</div>';
    try {
      const fd = new FormData();
      fd.append('openid', OPENID);
      fd.append('image', file);
      const data = await api('/v3/image/upload', { method: 'POST', formData: fd });
      const localUrl = OFFLINE ? '' : URL.createObjectURL(file);
      store.set('capture', {
        image_filename: data.image_filename,
        local_preview: localUrl,
        recognition: data.analysis_result || {}
      });
      go('#/confirm');
    } catch (e) {
      toast(e.message);
      viewCapture();
    }
  };
}

// ---------- 视图 2b：确认识别结果 ----------

function viewConfirm() {
  setNav('');
  const cap = store.get('capture');
  if (!cap) { go('#/capture'); return; }
  const r = cap.recognition || {};

  document.getElementById('app').innerHTML =
    '<h2 class="page-title">是它吗？</h2>' +
    '<div class="card">' +
    (cap.local_preview ? '<img class="upload-preview" src="' + cap.local_preview + '">' : '') +
    '  <div class="form-item"><label class="form-label">叫它什么</label>' +
    '    <input class="form-input" id="fTitle" value="' + esc(r.name || '') + '"></div>' +
    '  <div class="form-item"><label class="form-label">算哪一类</label>' +
    '    <input class="form-input" id="fCategory" value="' + esc(r.category || '') + '"></div>' +
    '  <div class="form-item"><label class="form-label">补充两句（不写也行）</label>' +
    '    <textarea class="form-textarea" id="fDesc">' + esc(r.description || '') + '</textarea></div>' +
    '  <button class="btn btn-primary btn-block btn-lg" id="btnSave">是它，开始聊聊</button>' +
    '</div>';

  document.getElementById('btnSave').onclick = async (ev) => {
    const btn = ev.target;
    const title = document.getElementById('fTitle').value.trim();
    if (!title) { toast('先给它起个名字吧'); return; }
    btn.disabled = true;
    btn.textContent = '记下了…';
    try {
      // 铁律：box_id 与 bag_id 同时省略（独立物品 = 同空）
      const data = await api('/v3/item/add', {
        method: 'POST',
        data: {
          openid: OPENID,
          title: title,
          description: document.getElementById('fDesc').value.trim(),
          category: document.getElementById('fCategory').value.trim(),
          image_filename: cap.image_filename,
          tags: r.tags || []
        }
      });
      const itemId = data.item_info.item_id;
      store.del('capture');
      store.del('analyze_' + itemId);
      go('#/question?item_id=' + itemId);
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = '是它，开始聊聊';
    }
  };
}

// ---------- 视图 3：四问 ----------

async function viewQuestion(params) {
  setNav('');
  const itemId = params.item_id;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">准备几个小问题…</div>';

  const data = await api('/v5/decision/questions');
  const questions = data.questions || [];
  const answers = {};

  app.innerHTML =
    '<h2 class="page-title">聊聊它：四个小问题</h2>' +
    '<div class="card" id="qCard">' +
    questions.map((q, qi) =>
      '<div class="q-block"><div class="q-title">' + (questions.indexOf(q) + 1) + '. ' + esc(q.title) + '</div>' +
      '<div class="q-options">' +
      q.options.map(o =>
        '<div class="q-option" data-q="' + q.key + '" data-v="' + esc(o.value) + '">' + esc(o.label) + '</div>').join('') +
      '</div></div>').join('') +
    '<button class="btn btn-primary btn-block btn-lg" id="btnAnalyze" disabled>答完了，帮我算算</button>' +
    '</div>';

  document.querySelectorAll('.q-option').forEach(el => {
    el.onclick = () => {
      const key = el.dataset.v !== undefined ? el.getAttribute('data-v') : '';
      const qk = el.getAttribute('data-q');
      answers[qk] = key;
      document.querySelectorAll('.q-option[data-q="' + qk + '"]').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      document.getElementById('btnAnalyze').disabled =
        !questions.every(q => answers[q.key]);
    };
  });

  document.getElementById('btnAnalyze').onclick = async (ev) => {
    const btn = ev.target;
    btn.disabled = true;
    btn.textContent = '正在帮你算…';
    try {
      const data = await api('/v5/decision/analyze', {
        method: 'POST',
        data: Object.assign({ openid: OPENID, item_id: Number(itemId) }, answers)
      });
      store.set('analyze_' + itemId, data);
      location.hash = '#/verdict?item_id=' + itemId;
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = '答完了，帮我算算';
    }
  };
}

// ---------- 视图 4：建议（六维） ----------

async function viewVerdict(params) {
  setNav('');
  const itemId = params.item_id;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">正在整理思路…</div>';

  let result = store.get('analyze_' + itemId);
  let itemTitle = '';
  let imageFilename = '';

  // 刷新或从列表进入时，从详情接口恢复结论
  const detail = await api('/v5/decision/item', { data: { openid: OPENID, item_id: itemId } });
  const item = detail.item || detail;
  itemTitle = item.title || '';
  imageFilename = item.image_filename || '';
  if (!result) {
    if (!item.ai_verdict) { go('#/question?item_id=' + itemId); return; }
    result = { dims: detail.dims || {}, dim_labels: detail.dim_labels || {}, score: item.ai_score, verdict: item.ai_verdict, reason: item.ai_reason };
  }

  const labels = result.dim_labels || {};
  const DIM_ORDER = ['usage', 'duplicate', 'need', 'rebuy', 'space', 'emotion'];
  const DIM_FALLBACK = { usage: '平时用得多吗', duplicate: '有没有能顶替的', need: '真的需要它吗', rebuy: '没了会再买吗', space: '它占地方吗', emotion: '舍不得它吗' };
  const verdict = result.verdict || 'observe';

  let html = '<h2 class="page-title">关于「' + esc(itemTitle) + '」，我是这么想的</h2>';
  const detailImg = imageFilename ? imgUrl(imageFilename) : '';
  if (detailImg) html += '<div class="card"><img class="detail-img" src="' + esc(detailImg) + '"></div>';

  html += '<div class="card" style="text-align:center;">' +
    '<span class="chip chip-' + esc(verdict) + '">' + (VERDICT_TEXT[verdict] || verdict) + '</span>' +
    '<div style="margin:12px 0;"><span class="score-big">' + (result.score != null ? result.score : '-') + '<small> /100</small></span></div>' +
    '<div class="text-sub">' + esc(result.reason || '') + '</div>' +
    '</div>';

  html += '<div class="card"><div class="card-title">我是从这六个方面看的</div>' +
    DIM_ORDER.map(k => {
      const v = Math.max(0, Math.min(100, Number((result.dims || {})[k] != null ? result.dims[k] : 0)));
      return '<div class="dim-row"><div class="dim-label">' + esc(labels[k] || DIM_FALLBACK[k]) + '</div>' +
        '<div class="dim-bar"><div class="dim-fill" style="width:' + v + '%"></div></div>' +
        '<div class="dim-value">' + v + '</div></div>';
    }).join('') +
    '<div class="footnote">分数越高，越偏向留下；「它占地方吗」分高说明它不占地儿。<br>这些只是我的参考，最后怎么定，听你的。</div>' +
    '</div>';

  html += '<div class="card"><div class="card-title">想好了吗？轮到你了</div>' +
    '<div class="btn-row">' +
    '  <button class="btn btn-green" data-decision="keep">留下它</button>' +
    '  <button class="btn btn-orange" data-decision="observe">再想想（冷静 30 天）</button>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:10px;">' +
    '  <button class="btn btn-primary" data-decision="sell">卖掉</button>' +
    '  <button class="btn btn-primary" data-decision="gift">送人</button>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:10px;">' +
    '  <button class="btn btn-outline" data-decision="recycle">回收</button>' +
    '  <button class="btn btn-red" data-decision="discard">扔掉</button>' +
    '</div></div>';

  app.innerHTML = html;

  document.querySelectorAll('[data-decision]').forEach(btn => {
    btn.onclick = async () => {
      const decision = btn.dataset.decision;
      document.querySelectorAll('[data-decision]').forEach(b => b.disabled = true);
      try {
        await api('/v5/decision/choose', {
          method: 'POST',
          data: { openid: OPENID, item_id: Number(itemId), decision }
        });
        store.del('analyze_' + itemId);
        if (decision === 'keep') { toast('好，它留下了'); go('#/'); }
        else if (decision === 'observe') { toast('先放进观察箱，30 天后再看'); go('#/observe'); }
        else { go('#/dispose?item_id=' + itemId + '&channel=' + decision); }
      } catch (e) {
        toast(e.message);
        document.querySelectorAll('[data-decision]').forEach(b => b.disabled = false);
      }
    };
  });
}

// ---------- 视图 5：观察箱 ----------

async function viewObserve() {
  setNav('observe');
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">加载中…</div>';

  const [overview, list, due] = await Promise.all([
    api('/v5/observe/overview', { data: { openid: OPENID } }),
    api('/v5/observe/list', { data: { openid: OPENID, status: 'observing' } }),
    api('/v5/observe/due', { data: { openid: OPENID } })
  ]);

  const dueItems = (due && due.items) || [];
  const badge = document.getElementById('navDueBadge');
  badge.hidden = !dueItems.length;
  badge.textContent = dueItems.length;

  const items = (list && list.items) || [];

  let html = '<h2 class="page-title">观察箱 · 给纠结一段冷静期</h2>';
  html += '<div class="stats">' +
    '<div class="stat pending" data-tip="拍了照、还没做出决定的东西"><div class="stat-num">' + (overview.pending || 0) + '</div><div class="stat-label">还没想好</div></div>' +
    '<div class="stat observing" data-tip="放进观察箱、还在 30 天冷静期里的东西"><div class="stat-num">' + (overview.observing || 0) + '</div><div class="stat-label">冷静期中</div></div>' +
    '<div class="stat resolved" data-tip="已经想清楚、做出决定的东西"><div class="stat-num">' + (overview.resolved || 0) + '</div><div class="stat-label">想清楚了</div></div>' +
    '</div>';

  html += '<div class="card"><div class="card-title">冷静期中（' + items.length + '）' +
    (dueItems.length ? ' <span class="badge">' + dueItems.length + ' 件该想想了</span>' : '') + '</div>';

  if (!items.length) {
    html += '<div class="empty">观察箱空着——说明你没有什么放不下的，挺好</div>';
  } else {
    html += items.map(it =>
      '<div class="card" style="margin-bottom:12px;' + (it.expired ? 'border-left:3px solid var(--red);' : '') + '">' +
      '  <div class="item-row" style="border:none;padding:0 0 10px;" onclick="go(\'#/item?item_id=' + it.item_id + '\')">' +
      itemThumb(it) +
      '    <div class="item-info"><div class="item-title">' + esc(it.title) + '</div>' +
      '    <div class="item-meta">冷静到 ' + esc(it.observe_until || '-') + ' · ' + daysLeftText(it) +
      ' · 这期间用了 ' + (it.observe_used_count || 0) + ' 次</div></div>' +
      '  </div>' +
      '  <div class="btn-row">' +
      '    <button class="btn btn-sm btn-primary" data-act="use" data-id="' + it.item_id + '">这次用上了</button>' +
      '    <button class="btn btn-sm btn-green" data-act="keep" data-id="' + it.item_id + '">留下</button>' +
      '    <button class="btn btn-sm btn-outline" data-act="dispose" data-id="' + it.item_id + '">送它走</button>' +
      '    <button class="btn btn-sm btn-outline" data-act="verdict" data-id="' + it.item_id + '">看分析</button>' +
      '  </div>' +
      '</div>').join('');
  }
  html += '</div>';
  app.innerHTML = html;

  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async (ev) => {
      ev.stopPropagation();
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      try {
        if (act === 'use') {
          const data = await api('/v5/observe/use', { method: 'POST', data: { openid: OPENID, item_id: id } });
          if ((data.observe_used_count || 0) >= 3) {
            await uiAlert((data.hint || '这件东西你最近用得挺勤') + '\n看来它是真有用，放心留下吧。');
          } else {
            toast(data.hint || ('记下了，这期间用了 ' + data.observe_used_count + ' 次'));
          }
          viewObserve();
        } else if (act === 'keep') {
          await api('/v5/decision/choose', { method: 'POST', data: { openid: OPENID, item_id: id, decision: 'keep' } });
          toast('好，它留下了');
          viewObserve();
        } else if (act === 'dispose') {
          // 观察中物品的 decision 还是 observe，必须先 choose 成处理类再进建议页
          go('#/dispose?item_id=' + id + '&from=observe');
        } else if (act === 'verdict') {
          go('#/verdict?item_id=' + id);
        }
      } catch (e) { toast(e.message); }
    };
  });
}

// ---------- 视图 6：处理建议 ----------

const CHANNELS = [
  { key: 'sell', label: '卖掉' },
  { key: 'gift', label: '送人' },
  { key: 'recycle', label: '回收' },
  { key: 'discard', label: '扔掉' }
];

async function viewDispose(params) {
  setNav('');
  const itemId = Number(params.item_id);
  let channel = params.channel || 'sell';
  if (channel === 'trash') channel = 'discard';
  const fromObserve = params.from === 'observe';

  // 从观察箱直接进入：decision 还是 observe，先落一个处理类 decision
  if (fromObserve) {
    await api('/v5/decision/choose', { method: 'POST', data: { openid: OPENID, item_id: itemId, decision: channel } });
  }

  async function render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loading">正在帮你想办法…</div>';

    let suggest = null;
    // 先读已生成的计划；不匹配当前渠道时再调 suggest
    try {
      const plan = await api('/v5/dispose/plan', { data: { openid: OPENID, item_id: itemId } });
      const planChannel = plan && plan.channel === 'trash' ? 'discard' : (plan && plan.channel);
      if (plan && plan.suggest && planChannel === channel) suggest = plan.suggest;
    } catch (e) { /* 没有计划则下面生成 */ }
    if (!suggest) {
      const data = await api('/v5/dispose/suggest', {
        method: 'POST',
        data: { openid: OPENID, item_id: itemId, channel }
      });
      suggest = data.suggest;
    }

    let html = '<h2 class="page-title">它的下一站</h2>';
    html += '<div class="tabs">' + CHANNELS.map(c =>
      '<div class="tab' + (c.key === channel ? ' active' : '') + '" data-ch="' + c.key + '">' + c.label + '</div>').join('') + '</div>';

    html += '<div class="card">';
    html += '<div class="card-title">' + esc(suggest.title_text || CHANNELS.find(c => c.key === channel).label) + '</div>';
    if (suggest.price_range) {
      const pr = suggest.price_range;
      html += '<div class="price-range">大概能卖：' + esc(typeof pr === 'object' ? (pr.min + ' ~ ' + pr.max + ' 元') : pr) + '</div>';
    }
    if (suggest.platforms && suggest.platforms.length) {
      html += '<div class="platforms">可以挂在：' + suggest.platforms.map(esc).join('、') + '</div>';
    }
    html += '<div class="dispose-text" id="disposeText">' + esc(suggest.body_text || '') + '</div>';
    if (suggest.tips && suggest.tips.length) {
      html += '<div class="footnote">' + suggest.tips.map(t => '· ' + esc(t)).join('<br>') + '</div>';
    }
    html += '<div class="btn-row section-gap">' +
      '<button class="btn btn-outline" id="btnCopy">复制这段文案</button>' +
      '<button class="btn btn-green" id="btnDone">已送走，标记完成</button>' +
      '</div>';
    html += '</div>';
    app.innerHTML = html;

    document.querySelectorAll('[data-ch]').forEach(tab => {
      tab.onclick = async () => {
        channel = tab.dataset.ch;
        // 切换渠道：先落 decision，再用 suggest 写回
        try {
          await api('/v5/decision/choose', { method: 'POST', data: { openid: OPENID, item_id: itemId, decision: channel } });
        } catch (e) { /* 已 resolved 时 choose 可能被拒，忽略，仅刷新文案 */ }
        render().catch(e => toast(e.message));
      };
    });

    document.getElementById('btnCopy').onclick = () => {
      const text = document.getElementById('disposeText').innerText;
      navigator.clipboard.writeText(text).then(() => toast('文案复制好了')).catch(() => toast('没复制上，长按手动复制吧'));
    };

    document.getElementById('btnDone').onclick = async () => {
      try {
        await api('/v5/decision/choose', { method: 'POST', data: { openid: OPENID, item_id: itemId, decision: channel } });
        toast('好，这件事到此为止了');
        go('#/');
      } catch (e) { toast(e.message); }
    };
  }

  await render();
}

// ---------- 视图 7：决策详情 ----------

async function viewItem(params) {
  setNav('');
  const itemId = params.item_id;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">加载中…</div>';

  const detail = await api('/v5/decision/item', { data: { openid: OPENID, item_id: itemId } });
  const item = detail.item || detail;
  const status = item.status || 'pending';

  let html = '<h2 class="page-title">这件东西</h2>';
  const itemImg = item.image_filename ? imgUrl(item.image_filename) : '';
  if (itemImg) html += '<div class="card"><img class="detail-img" src="' + esc(itemImg) + '"></div>';

  html += '<div class="card">' +
    '<div class="item-title" style="font-size:18px;">' + esc(item.title) + '</div>' +
    '<div class="item-meta">' + esc(item.category || '未分类') + ' · <span class="chip chip-pending">' + (STATUS_TEXT[status] || status) + '</span></div>' +
    (item.description ? '<p class="text-sub" style="margin-top:10px;">' + esc(item.description) + '</p>' : '') +
    (item.observe_until ? '<p class="text-sub" style="margin-top:6px;">冷静期到 ' + esc(item.observe_until) + '</p>' : '') +
    (item.decision ? '<p class="text-sub" style="margin-top:6px;">你的决定：' + esc(DECISION_TEXT[item.decision] || item.decision) + '</p>' : '') +
    '</div>';

  if (item.ai_verdict) {
    const dims = detail.dims || {};
    const labels = detail.dim_labels || {};
    const DIM_ORDER = ['usage', 'duplicate', 'need', 'rebuy', 'space', 'emotion'];
    const DIM_FALLBACK = { usage: '平时用得多吗', duplicate: '有没有能顶替的', need: '真的需要它吗', rebuy: '没了会再买吗', space: '它占地方吗', emotion: '舍不得它吗' };

    html += '<div class="card" style="text-align:center;">' +
      '<span class="chip chip-' + esc(item.ai_verdict) + '">' + (VERDICT_TEXT[item.ai_verdict] || item.ai_verdict) + '</span>' +
      '<div style="margin:12px 0;"><span class="score-big">' + (item.ai_score != null ? item.ai_score : '-') + '<small> /100</small></span></div>' +
      '<div class="text-sub">' + esc(item.ai_reason || '') + '</div></div>';

    html += '<div class="card"><div class="card-title">我是从这六个方面看的</div>' +
      DIM_ORDER.map(k => {
        const v = Math.max(0, Math.min(100, Number(dims[k] != null ? dims[k] : 0)));
        return '<div class="dim-row"><div class="dim-label">' + esc(labels[k] || DIM_FALLBACK[k]) + '</div>' +
          '<div class="dim-bar"><div class="dim-fill" style="width:' + v + '%"></div></div>' +
          '<div class="dim-value">' + v + '</div></div>';
      }).join('') + '</div>';
  }

  html += '<div class="btn-row">';
  if (status === 'pending') {
    html += item.ai_verdict
      ? '<button class="btn btn-primary" onclick="go(\'#/verdict?item_id=' + itemId + '\')">一起想想</button>'
      : '<button class="btn btn-primary" onclick="go(\'#/question?item_id=' + itemId + '\')">一起想想</button>';
  } else {
    html += '<button class="btn btn-outline" onclick="go(\'#/verdict?item_id=' + itemId + '\')">看分析</button>';
    if (status !== 'resolved' || item.decision !== 'keep') {
      html += '<button class="btn btn-primary" onclick="go(\'#/dispose?item_id=' + itemId + '\')">它的下一站</button>';
    }
  }
  html += '<button class="btn btn-outline" onclick="history.back()">返回</button></div>';

  app.innerHTML = html;
}

// ---------- 路由与启动 ----------

const routes = {
  '/': viewHome,
  '/capture': viewCapture,
  '/confirm': viewConfirm,
  '/question': viewQuestion,
  '/verdict': viewVerdict,
  '/observe': viewObserve,
  '/dispose': viewDispose,
  '/item': viewItem
};

async function route() {
  const { path, params } = parseHash();
  const view = routes[path] || viewHome;
  try {
    await view(params);
  } catch (e) {
    document.getElementById('app').innerHTML =
      '<div class="card"><div class="empty">哎呀，出了点问题：' + esc(e.message) +
      '<br><br><button class="btn btn-outline" onclick="route()">再试一次</button></div></div>';
  }
}

window.addEventListener('hashchange', route);

(async function boot() {
  // 探测后端：file:// 双击直接走演示；http 下先看 /health，不通也走演示
  if (location.protocol !== 'file:') {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1200);
      const r = await fetch(BASE + '/health', { signal: ctrl.signal });
      clearTimeout(timer);
      OFFLINE = !r.ok;
    } catch (e) {
      OFFLINE = true;
    }
  }

  // 前置事实：所有接口按 openid 查 user_id，首次进入必须先建号
  try {
    await api('/v0/home/info', { data: { openid: OPENID } });
  } catch (e) {
    document.getElementById('app').innerHTML =
      '<div class="card"><div class="empty">没能进入，别担心：' + esc(e.message) +
      '<br><br><button class="btn btn-primary" onclick="location.reload()">再试一次</button></div></div>';
    return;
  }
  setModeHint();
  route();
})();
