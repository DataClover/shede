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
    if (this._loading) return;
    this._loading = true;
    this.setData({ loading: true });
    try {
      const openid = api.openid();
      const [overview, list, due] = await Promise.all([
        api.request('/v5/observe/overview', { data: { openid } }),
        api.request('/v5/observe/list', { data: { openid, status: 'observing' } }),
        api.request('/v5/observe/due', { data: { openid } })
      ]);
      this.setData({
        overview: Object.assign({}, overview, { due_count: due.count || 0 }),
        items: list.items || [],
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    } finally {
      this._loading = false;
    }
  },

  async onUsed(e) {
    try {
      const data = await api.request('/v5/observe/use', {
        method: 'POST',
        data: { openid: api.openid(), item_id: e.currentTarget.dataset.id }
      });
      if (data.observe_used_count >= 3) {
        wx.showModal({
          title: '可以直接留下',
          content: data.hint,
          showCancel: false,
          confirmText: '知道了'
        });
      } else {
        wx.showToast({ title: data.hint || '记下了', icon: 'none', duration: 2200 });
      }
      this.load();
    } catch (error) {
      api.toastError(error);
    }
  },

  async onKeep(e) {
    try {
      await api.request('/v5/decision/choose', {
        method: 'POST',
        data: { openid: api.openid(), item_id: e.currentTarget.dataset.id, decision: 'keep' }
      });
      wx.showToast({ title: '已留下', icon: 'success' });
      this.load();
    } catch (error) {
      api.toastError(error);
    }
  },

  onDispose(e) {
    wx.navigateTo({
      url: `/packageShede/pages/dispose/dispose?item_id=${e.currentTarget.dataset.id}&channel=sell`
    });
  },

  onVerdict(e) {
    wx.navigateTo({ url: `/packageShede/pages/verdict/verdict?item_id=${e.currentTarget.dataset.id}` });
  },

  onHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  onRefresh() {
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  }
});
