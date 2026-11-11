/* 舍得 · 离线演示引擎
 * 用途：双击 index.html（file:// 协议）或后端未启动时，完整模拟决策流。
 * 规则与后端 v5_decision.py 保持一致（同样的四问、同样的打分权重、同样的阈值），
 * 保证「演示模式」和「真 AI 模式」讲的是同一套逻辑。
 * 数据存在 localStorage；不可用时退回内存，刷新即清空。
 */
(function () {
  'use strict';

  var OPENID = 'demouser00000000000000000000';
  var LS_KEY = 'shede_demo_db_v1';
  var IMG_MEM = {};

  // ---------- 与后端完全一致的定义 ----------

  var QUESTIONS = [
    {
      key: 'usage_answer',
      title: '最近一次用它是什么时候？',
      options: [
        { value: 'recent', label: '这周用过' },
        { value: 'month', label: '这个月用过' },
        { value: 'long', label: '半年内用过' },
        { value: 'never', label: '想不起来了' }
      ]
    },
    {
      key: 'rebuy_answer',
      title: '如果现在没有它，你会再买一个吗？',
      options: [
        { value: 'yes', label: '会，用得上' },
        { value: 'unsure', label: '说不好' },
        { value: 'no', label: '不会' }
      ]
    },
    {
      key: 'replace_answer',
      title: '你手边有别的东西能替代它吗？',
      options: [
        { value: 'none', label: '没有，只此一个' },
        { value: 'has', label: '有别的能顶' },
        { value: 'broken', label: '它坏了/不能用了' }
      ]
    },
    {
      key: 'emotion_answer',
      title: '它对你有多重要（情感/纪念）？',
      options: [
        { value: 'high', label: '很重要' },
        { value: 'mid', label: '一般' },
        { value: 'low', label: '没什么感觉' }
      ]
    }
  ];

  var SCORE_MAP = {
    usage: { recent: 90, month: 65, long: 35, never: 10 },
    rebuy: { yes: 85, unsure: 55, no: 20 },
    replace: { none: 80, has: 40, broken: 30 },
    emotion: { high: 85, mid: 55, low: 20 }
  };

  var WEIGHTS = { usage: 0.25, need: 0.20, rebuy: 0.15, duplicate: 0.15, space: 0.10, emotion: 0.15 };

  var DIM_LABELS = {
    usage: '使用频率', duplicate: '是否重复', need: '实际需求',
    rebuy: '重新购买意愿', space: '占用空间', emotion: '情感价值'
  };

  var DEMO_RECOGNITIONS = [
    { name: '旧蓝牙耳机', category: '电子产品', description: '用了三年的入耳式耳机，右耳偶尔断连。', tags: ['电子', '耳机'] },
    { name: '闲置瑜伽垫', category: '运动器材', description: '买来练过两次，之后一直收在柜子里。', tags: ['运动', '垫子'] },
    { name: '多余的马克杯', category: '生活用品', description: '柜子里已经有四个杯子，这个是活动赠品。', tags: ['杯子', '生活'] },
    { name: '旧款数据线', category: '电子产品', description: '设备接口已更换，这条线基本用不上了。', tags: ['电子', '配件'] },
    { name: '穿旧的帆布鞋', category: '服饰鞋包', description: '鞋底磨损明显，但一直没舍得扔。', tags: ['鞋', '服饰'] }
  ];

  var DISPOSE_TPL = {
    sell: {
      title_text: '出售建议',
      price_range: { min: 20, max: 80 },
      platforms: ['闲鱼', '转转'],
      body_text: '【闲置转让】功能正常，成色自用，具体可私聊看细节。同城可自提，异地走快递，价格可小刀。',
      tips: ['拍 3~5 张实物图（正面、细节、瑕疵）更容易成交', '定价参考平台同类成交价，别按原价挂', '如实描述瑕疵，避免售后纠纷']
    },
    gift: {
      title_text: '转赠建议',
      price_range: null,
      platforms: ['朋友圈', '小区闲置群'],
      body_text: '【免费转赠】东西还能用，扔了可惜。有需要的朋友自取，同城优先，先到先得。',
      tips: ['写清尺寸、成色和自提地点', '送给真正用得上的人，避免二次闲置', '当面交付时可以顺便聊聊它的用法']
    },
    recycle: {
      title_text: '回收建议',
      price_range: { min: 0, max: 20 },
      platforms: ['爱回收', '小区回收点'],
      body_text: '【环保回收】物品已无法正常使用，交给正规回收渠道处理，避免随意丢弃污染环境。',
      tips: ['电子产品先清空个人数据', '电池、灯管等属于有害垃圾，需单独投放', '可攒一批一起回收，更省事']
    },
    discard: {
      title_text: '丢弃建议',
      price_range: null,
      platforms: ['社区垃圾分类点'],
      body_text: '【垃圾分类】物品已无使用价值，按当地分类标准投放。',
      tips: ['先确认是否属于可回收物', '尖锐物品包好再扔，避免划伤清洁人员', '能拆解的尽量拆开分类']
    }
  };

  // ---------- 存储 ----------

  var DB = (function () {
    try {
      var s = localStorage.getItem(LS_KEY);
      if (s) {
        var d = JSON.parse(s);
        if (d && Array.isArray(d.items)) return d;
      }
    } catch (e) { /* file:// 下部分浏览器禁用 storage，退回内存 */ }
    return { items: [], seq: 0 };
  })();

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(DB)); } catch (e) { /* 内存模式 */ }
  }

  function findItem(id) {
    var n = Number(id);
    for (var i = 0; i < DB.items.length; i++) {
      if (DB.items[i].item_id === n) return DB.items[i];
    }
    return null;
  }

  // ---------- 日期 ----------

  function today() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function fmtDate(d) {
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }
  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  // ---------- 打分（与后端规则版一致） ----------

  function ruleDims(a) {
    var usage = SCORE_MAP.usage[a.usage_answer] != null ? SCORE_MAP.usage[a.usage_answer] : 35;
    var rebuy = SCORE_MAP.rebuy[a.rebuy_answer] != null ? SCORE_MAP.rebuy[a.rebuy_answer] : 55;
    var duplicate = SCORE_MAP.replace[a.replace_answer] != null ? SCORE_MAP.replace[a.replace_answer] : 50;
    var emotion = SCORE_MAP.emotion[a.emotion_answer] != null ? SCORE_MAP.emotion[a.emotion_answer] : 55;
    var need = Math.round(rebuy * 0.6 + usage * 0.4);
    return { usage: usage, duplicate: duplicate, need: need, rebuy: rebuy, space: 50, emotion: emotion };
  }

  function ruleReason(d) {
    var parts = [];
    if (d.usage <= 35) parts.push('很久没用了');
    else if (d.usage >= 65) parts.push('最近还在用');
    if (d.duplicate <= 40) parts.push('手边有东西能替代它');
    if (d.emotion >= 85) parts.push('但情感价值很高');
    else if (d.emotion <= 20) parts.push('对你也谈不上纪念意义');
    if (!parts.length) parts.push('各项指标都不算极端');
    return parts.join('，') + '。';
  }

  function weighted(dims) {
    var total = 0;
    for (var k in WEIGHTS) {
      if (Object.prototype.hasOwnProperty.call(WEIGHTS, k)) {
        total += (dims[k] != null ? dims[k] : 50) * WEIGHTS[k];
      }
    }
    return Math.max(0, Math.min(100, Math.round(total)));
  }

  function verdictOf(score) {
    if (score >= 65) return 'keep';
    if (score >= 40) return 'observe';
    return 'dispose';
  }

  // ---------- 图片 ----------

  function readImage(file) {
    return new Promise(function (resolve) {
      if (!file) return resolve('');
      var fr = new FileReader();
      fr.onload = function () {
        var raw = String(fr.result || '');
        var img = new Image();
        img.onload = function () {
          try {
            var max = 900;
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.82));
          } catch (e) { resolve(raw); }
        };
        img.onerror = function () { resolve(raw); };
        img.src = raw;
      };
      fr.onerror = function () { resolve(''); };
      fr.readAsDataURL(file);
    });
  }

  function pickRecognition() {
    // 同一物品名在一个会话里稳定：用随机起点，避免每次刷新都变
    var idx = Math.floor(Math.random() * DEMO_RECOGNITIONS.length);
    return JSON.parse(JSON.stringify(DEMO_RECOGNITIONS[idx]));
  }

  // ---------- 对外物品视图 ----------

  function publicItem(it) {
    var out = {};
    for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) out[k] = it[k];
    if (it.status === 'observing' && it.observe_until) {
      var dl = daysBetween(today(), new Date(it.observe_until + 'T00:00:00'));
      out.days_left = dl;
      out.expired = dl <= 0;
    }
    return out;
  }

  // ---------- 路由处理 ----------

  async function handle(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var data = opts.data || {};
    var formData = opts.formData || null;
    var p = String(path).split('?')[0];

    await sleep(method === 'GET' ? 120 : 320); // 轻微延迟，让加载态自然

    // 用户
    if (p === '/v0/home/info') {
      return { openid: OPENID, is_new: false, nickname: '演示用户' };
    }

    // 识图
    if (p === '/v3/image/upload') {
      var file = formData ? formData.get('image') : null;
      var url = await readImage(file);
      var id = 'demo_' + Date.now() + '.jpg';
      if (url) IMG_MEM[id] = url;
      var rec = pickRecognition();
      return { image_filename: id, analysis_result: rec, source: 'demo' };
    }

    // 建物品
    if (p === '/v3/item/add') {
      DB.seq += 1;
      var item = {
        item_id: DB.seq,
        title: data.title || '未命名物品',
        description: data.description || '',
        category: data.category || '未分类',
        image_filename: data.image_filename || '',
        status: 'pending',
        ai_verdict: null,
        ai_score: null,
        ai_reason: '',
        ai_dims: null,
        decision: null,
        observe_until: null,
        observe_used_count: 0,
        created_at: fmtDate(today())
      };
      DB.items.push(item);
      save();
      return { item_info: item };
    }

    // 四问
    if (p === '/v5/decision/questions') {
      return { questions: QUESTIONS };
    }

    // 六维分析
    if (p === '/v5/decision/analyze') {
      var it = findItem(data.item_id);
      if (!it) throw new Error('物品不存在');
      var dims = ruleDims(data);
      var score = weighted(dims);
      var verdict = verdictOf(score);
      var reason = ruleReason(dims);
      it.ai_dims = dims;
      it.ai_score = score;
      it.ai_verdict = verdict;
      it.ai_reason = reason;
      save();
      return { dims: dims, dim_labels: DIM_LABELS, score: score, verdict: verdict, reason: reason, source: 'demo' };
    }

    // 物品详情
    if (p === '/v5/decision/item') {
      var it2 = findItem(data.item_id);
      if (!it2) throw new Error('物品不存在');
      return { item: publicItem(it2), dims: it2.ai_dims || {}, dim_labels: DIM_LABELS };
    }

    // 四选一
    if (p === '/v5/decision/choose') {
      var it3 = findItem(data.item_id);
      if (!it3) throw new Error('物品不存在');
      var d = data.decision;
      if (d === 'observe') {
        it3.status = 'observing';
        it3.observe_until = fmtDate(addDays(today(), 30));
      } else if (d === 'keep' || d === 'sell' || d === 'gift' || d === 'recycle' || d === 'discard') {
        it3.status = 'resolved';
      } else {
        throw new Error('无效的选择');
      }
      it3.decision = d;
      save();
      return { status: it3.status, decision: d };
    }

    // 观察箱总览
    if (p === '/v5/observe/overview') {
      var c = { pending: 0, observing: 0, resolved: 0 };
      DB.items.forEach(function (x) { if (c[x.status] != null) c[x.status] += 1; });
      return c;
    }

    // 观察箱列表
    if (p === '/v5/observe/list') {
      var st = data.status;
      var list = DB.items.filter(function (x) { return !st || x.status === st; })
        .map(publicItem);
      return { items: list };
    }

    // 到期
    if (p === '/v5/observe/due') {
      var due = DB.items.filter(function (x) {
        if (x.status !== 'observing') return false;
        var o = publicItem(x);
        return o.expired;
      }).map(publicItem);
      return { items: due };
    }

    // 观察期用到了
    if (p === '/v5/observe/use') {
      var it4 = findItem(data.item_id);
      if (!it4) throw new Error('物品不存在');
      it4.observe_used_count = (it4.observe_used_count || 0) + 1;
      save();
      var n = it4.observe_used_count;
      var hint = n >= 3 ? '这件东西你观察期内用了 ' + n + ' 次，看来是真需要'
        : '已记录，观察期内用了 ' + n + ' 次';
      return { observe_used_count: n, hint: hint };
    }

    // 处理计划（已有文案则复用）
    if (p === '/v5/dispose/plan') {
      var it5 = findItem(data.item_id);
      if (!it5) throw new Error('物品不存在');
      var key = it5.decision;
      if (key && DISPOSE_TPL[key]) {
        return { channel: key, suggest: DISPOSE_TPL[key] };
      }
      return { channel: null, suggest: null };
    }

    // 生成处理建议
    if (p === '/v5/dispose/suggest') {
      var tpl = DISPOSE_TPL[data.channel];
      if (!tpl) throw new Error('无效的处理渠道');
      return { suggest: tpl, channel: data.channel };
    }

    throw new Error('演示模式未实现的接口：' + p);
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ---------- 对外接口 ----------

  var OFFLINE = location.protocol === 'file:';

  window.SHEDE_OFFLINE = {
    handle: handle,
    isOffline: function () { return OFFLINE; },
    markOffline: function () { OFFLINE = true; },
    imgUrl: function (fn) { return IMG_MEM[fn] || ''; },
    /** 直接把示例物品写进 capture，跳过选图 */
    sampleCapture: function () {
      var rec = pickRecognition();
      var id = 'demo_sample_' + Date.now() + '.jpg';
      return Promise.resolve({ image_filename: id, analysis_result: rec, source: 'demo' });
    },
    reset: function () {
      DB = { items: [], seq: 0 };
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    }
  };
})();
