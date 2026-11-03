// packageShede/pages/verdict/verdict.js
// 六维结论页：看清 AI 怎么算的，然后自己四选一
const api = require('../../utils/api.js');

const ORDER = ['usage', 'duplicate', 'need', 'rebuy', 'space', 'emotion'];

Page({
  data: {
    itemId: 0,
    result: null,
    dims: [],
    chipClass: '',
    chooseLoading: ''
  },

  onLoad(options) {
    const itemId = parseInt(options.item_id || 0, 10);
    const cached = getApp().globalData.shedeResult;
    if (cached && cached.item_id === itemId) {
      this.applyResult(cached);
      getApp().globalData.shedeResult = null;
    } else {
      // 从「我的物品」直接进来：读库里已有的结论
      this.loadSaved(itemId);
    }
    this.setData({ itemId });
  },

  async loadSaved(itemId) {
    try {
      const data = await api.request('/v5/decision/item', { data: { openid: api.openid(), item_id: itemId } });
      if (data.dims) {
        this.applyResult({
          item_id: itemId,
          title: data.item && data.item.title,
          dims: data.dims,
          score: data.item.ai_score,
          verdict: data.item.ai_verdict,
          reason: data.item.ai_reason,
          advice: ''
        });
      } else {
        wx.showModal({
          title: '还没分析过',
          content: '这件东西还没有 AI 结论，先去答几个问题吧',
          confirmText: '去答题',
          success: r => {
            if (r.confirm) {
              wx.redirectTo({ url: `/packageShede/pages/question/question?item_id=${itemId}` });
            }
          }
        });
      }
    } catch (e) {
      api.toastError(e);
    }
  },

  applyResult(result) {
    const labels = result.dim_labels || {
      usage: '使用频率', duplicate: '是否重复', need: '实际需求',
      rebuy: '重新购买意愿', space: '占用空间', emotion: '情感价值'
    };
    const dims = ORDER.map(k => {
      const v = (result.dims && result.dims[k] !== undefined) ? result.dims[k] : 50;
      return {
        key: k,
        name: labels[k] || k,
        value: v,
        cls: v >= 65 ? '' : (v >= 40 ? 'warn' : 'bad')
      };
    });
    const verdict = result.verdict || (result.score >= 65 ? 'keep' : (result.score >= 40 ? 'observe' : 'dispose'));
    this.setData({
      result,
      dims,
      chipClass: 'chip-' + verdict
    });
    wx.setNavigationBarTitle({ title: result.title ? result.title : '该不该留' });
  },

  // 留下 / 观察 30 天
  async onChoose(e) {
    const decision = e.currentTarget.dataset.decision;
    if (this.data.chooseLoading) return;
    this.setData({ chooseLoading: decision });
    try {
      const data = await api.request('/v5/decision/choose', {
        data: { openid: api.openid(), item_id: this.data.itemId, decision }
      });
      wx.showToast({ title: data.message || '已记录', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/packageShede/pages/observe/observe' });
      }, 900);
    } catch (e2) {
      api.toastError(e2);
    } finally {
      this.setData({ chooseLoading: '' });
    }
  },

  // 卖掉或送人 -> 处理建议页
  onDispose(e) {
    const channel = e.currentTarget.dataset.channel || 'sell';
    wx.navigateTo({
      url: `/packageShede/pages/dispose/dispose?item_id=${this.data.itemId}&channel=${channel}`
    });
  },

  // 丢掉直接落库
  async onDiscard() {
    const r = await new Promise(resolve => {
      wx.showModal({
        title: '确认丢掉？',
        content: '这条会直接记成已处理，之后还能在已处理里看到',
        confirmText: '确认丢掉',
        success: res => resolve(res.confirm)
      });
    });
    if (!r) return;
    try {
      await api.request('/v5/decision/choose', {
        data: { openid: api.openid(), item_id: this.data.itemId, decision: 'discard' }
      });
      wx.showToast({ title: '已标记丢弃', icon: 'success' });
      setTimeout(() => wx.redirectTo({ url: '/packageShede/pages/observe/observe' }), 900);
    } catch (e) {
      api.toastError(e);
    }
  },

  onRetry() {
    wx.redirectTo({ url: `/packageShede/pages/question/question?item_id=${this.data.itemId}` });
  }
});
