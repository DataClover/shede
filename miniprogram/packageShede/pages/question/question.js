const api = require('../../../utils/api.js');

Page({
  data: {
    itemId: 0,
    item: {},
    questions: [],
    answers: {},
    loading: true,
    submitting: false
  },

  onLoad(options) {
    const itemId = parseInt(options.item_id || options.itemId || 0, 10);
    this.setData({ itemId });
    this.loadAll();
  },

  async loadAll() {
    wx.showLoading({ title: '加载中...' });
    try {
      const [questionData, itemData] = await Promise.all([
        api.request('/v5/decision/questions'),
        api.request('/v5/decision/item', {
          data: { openid: api.openid(), item_id: this.data.itemId }
        })
      ]);
      const answers = {};
      (questionData.questions || []).forEach(question => {
        answers[question.key] = itemData.item && itemData.item[question.key] || '';
      });
      this.setData({
        questions: questionData.questions || [],
        item: itemData.item || {},
        answers,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    } finally {
      wx.hideLoading();
    }
  },

  onPick(e) {
    const { key, value } = e.currentTarget.dataset;
    this.setData({ answers: Object.assign({}, this.data.answers, { [key]: value }) });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const missing = this.data.questions.filter(question => !this.data.answers[question.key]);
    if (missing.length) {
      wx.showToast({ title: `请完成全部 ${this.data.questions.length} 个问题`, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '正在帮你算…' });
    try {
      const payload = Object.assign({
        openid: api.openid(),
        item_id: this.data.itemId
      }, this.data.answers);
      const result = await api.request('/v5/decision/analyze', { method: 'POST', data: payload });
      getApp().globalData.shedeResult = result;
      wx.redirectTo({ url: `/packageShede/pages/verdict/verdict?item_id=${this.data.itemId}` });
    } catch (error) {
      api.toastError(error);
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
