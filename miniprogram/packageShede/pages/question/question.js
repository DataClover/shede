// packageShede/pages/question/question.js
// 决策前问卷：4 个问题，答完提交 AI 六维分析
const api = require('../../utils/api.js');

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
    try {
      wx.showLoading({ title: '加载中...' });
      const [qRes, itemRes] = await Promise.all([
        api.request('/v5/decision/questions'),
        api.request('/v5/decision/item', { data: { openid: api.openid(), item_id: this.data.itemId } })
      ]);
      wx.hideLoading();

      // 解析成 {usage_answer: 'recent', ...} 便于提交
      const answers = {};
      (qRes.questions || []).forEach(q => {
        answers[q.key] = itemRes.item && itemRes.item[q.key] ? itemRes.item[q.key] : '';
      });

      this.setData({
        questions: qRes.questions || [],
        dimLabels: qRes.dim_labels || {},
        item: itemRes.item || {},
        answers,
        loading: false
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ loading: false });
      api.toastError(e);
    }
  },

  onPick(e) {
    const { key, value } = e.currentTarget.dataset;
    const answers = Object.assign({}, this.data.answers, { [key]: value });
    this.setData({ answers });
  },

  // 没答的题给个默认，避免提交被拦
  buildPayload() {
    const fill = {
      usage_answer: 'never',
      rebuy_answer: 'unsure',
      replace_answer: 'none',
      emotion_answer: 'mid'
    };
    const answers = Object.assign({}, fill, this.data.answers);
    return Object.assign({ openid: api.openid(), item_id: this.data.itemId }, answers);
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const missing = this.data.questions.filter(q => !this.data.answers[q.key]).length;
    if (missing > 0) {
      const r = await new Promise(resolve => {
        wx.showModal({
          title: '还有题没答',
          content: `还有 ${missing} 题没选，直接用默认答案继续吗？`,
          confirmText: '继续',
          cancelText: '回去答题',
          success: res => resolve(res.confirm)
        });
      });
      if (!r) return;
    }

    this.setData({ submitting: true });
    try {
      wx.showLoading({ title: 'AI 分析中...' });
      const result = await api.request('/v5/decision/analyze', { data: this.buildPayload() });
      wx.hideLoading();
      getApp().globalData.shedeResult = result;
      wx.navigateTo({ url: `/packageShede/pages/verdict/verdict?item_id=${this.data.itemId}` });
    } catch (e) {
      wx.hideLoading();
      api.toastError(e);
    } finally {
      this.setData({ submitting: false });
    }
  }
});
