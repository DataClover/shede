// packageShede/pages/observe/observe.js
// 观察箱：看谁快到期、到期了什么该处理，以及三态总览
const api = require('../../utils/api.js');

Page({
  data: {
    overview: {},
    items: [],
    loading: true
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      wx.showLoading({ title: '加载中...' });
      const [ov, list] = await Promise.all([
        api.request('/v5/observe/overview', { data: { openid: api.openid() } }),
        api.request('/v5/observe/list', { data: { openid: api.openid() } })
      ]);
      wx.hideLoading();
      this.setData({
        overview: ov,
        items: list.items || [],
        loading: false
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ loading: false });
      api.toastError(e);
    }
  },

  // 观察期内「我用到了」
  async onUsed(e) {
    const itemId = e.currentTarget.dataset.id;
    try {
      const data = await api.request('/v5/observe/use', {
        data: { openid: api.openid(), item_id: itemId }
      });
      wx.showToast({ title: data.hint || '记下了', icon: 'none', duration: 2200 });
      this.load();
    } catch (err) {
      api.toastError(err);
    }
  },

  // 到期了：直接留下
  async onKeep(e) {
    const itemId = e.currentTarget.dataset.id;
    try {
      await api.request('/v5/decision/choose', {
        data: { openid: api.openid(), item_id: itemId, decision: 'keep' }
      });
      wx.showToast({ title: '已留下', icon: 'success' });
      this.load();
    } catch (err) {
      api.toastError(err);
    }
  },

  // 到期了：去处理（卖/送/回收）
  onDispose(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageShede/pages/dispose/dispose?item_id=${itemId}&channel=sell`
    });
  },

  // 重新看结论
  onVerdict(e) {
    const itemId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageShede/pages/verdict/verdict?item_id=${itemId}` });
  },

  onRefresh() {
    this.load();
  }
});
