const api = require('../../../utils/api.js');

const ORDER = ['usage', 'duplicate', 'need', 'rebuy', 'space', 'emotion'];
const DEFAULT_LABELS = {
  usage: '使用频率',
  duplicate: '是否重复',
  need: '实际需求',
  rebuy: '重新购买意愿',
  space: '占用空间',
  emotion: '情感价值'
};

Page({
  data: {
    itemId: 0,
    result: null,
    dims: [],
    chipClass: '',
    chooseLoading: '',
    expandedChoice: ''
  },

  onLoad(options) {
    const itemId = parseInt(options.item_id || 0, 10);
    const cached = getApp().globalData.shedeResult;
    this.setData({ itemId });
    if (cached && cached.item_id === itemId) {
      this.applyResult(cached);
      getApp().globalData.shedeResult = null;
    } else {
      this.loadSaved(itemId);
    }
  },

  async loadSaved(itemId) {
    try {
      const data = await api.request('/v5/decision/item', {
        data: { openid: api.openid(), item_id: itemId }
      });
      if (data.dims && data.item && data.item.ai_verdict) {
        this.applyResult({
          item_id: itemId,
          title: data.item.title,
          dims: data.dims,
          dim_labels: data.dim_labels,
          score: data.item.ai_score,
          verdict: data.item.ai_verdict,
          reason: data.item.ai_reason,
          advice: ''
        });
      } else {
        wx.showModal({
          title: '还没聊过它',
          content: '这件东西还没有结论，先回答四个小问题吧',
          confirmText: '去答题',
          showCancel: false,
          success: () => wx.redirectTo({ url: `/packageShede/pages/question/question?item_id=${itemId}` })
        });
      }
    } catch (error) {
      api.toastError(error);
    }
  },

  applyResult(result) {
    const labels = result.dim_labels || DEFAULT_LABELS;
    const dims = ORDER.map(key => {
      const raw = result.dims && result.dims[key];
      const value = Math.max(0, Math.min(100, Number(raw === undefined ? 50 : raw)));
      return {
        key,
        name: DEFAULT_LABELS[key] || labels[key],
        value,
        cls: value >= 65 ? '' : (value >= 40 ? 'warn' : 'bad')
      };
    });
    const verdict = result.verdict || (result.score >= 65 ? 'keep' : (result.score >= 40 ? 'observe' : 'dispose'));
    this.setData({ result, dims, chipClass: 'chip-' + verdict });
    wx.setNavigationBarTitle({ title: result.title || '我是这么想的' });
  },

  onToggleChoice(e) {
    const choice = e.currentTarget.dataset.choice;
    this.setData({ expandedChoice: this.data.expandedChoice === choice ? '' : choice });
  },

  async onChoose(e) {
    const decision = e.currentTarget.dataset.decision;
    if (!decision || this.data.chooseLoading) return;
    this.setData({ chooseLoading: decision });
    try {
      await api.request('/v5/decision/choose', {
        method: 'POST',
        data: { openid: api.openid(), item_id: this.data.itemId, decision }
      });
      if (decision === 'keep') {
        wx.showToast({ title: '好，它留下了', icon: 'success' });
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 500);
      } else if (decision === 'observe') {
        wx.showToast({ title: '先放进观察箱，30 天后再看', icon: 'none' });
        setTimeout(() => wx.switchTab({ url: '/pages/observe/observe' }), 500);
      } else {
        wx.redirectTo({
          url: `/packageShede/pages/dispose/dispose?item_id=${this.data.itemId}&channel=${decision}`
        });
      }
    } catch (error) {
      api.toastError(error);
    } finally {
      this.setData({ chooseLoading: '' });
    }
  },

  onRetry() {
    wx.redirectTo({ url: `/packageShede/pages/question/question?item_id=${this.data.itemId}` });
  }
});
