const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    loading: true,
    overview: { pending: 0, observing: 0, resolved: 0, due_count: 0 },
    pendingItems: [],
    dueItems: []
  },

  onShow() {
    this.loadData();
  },

  waitForReady() {
    if (app.globalData.systemReady) return Promise.resolve();
    return new Promise(resolve => app.registerSystemReadyCallback(resolve));
  },

  async loadData() {
    if (this._loading) return;
    this._loading = true;
    this.setData({ loading: true });
    try {
      await this.waitForReady();
      const openid = api.openid();
      const [overview, pending, due] = await Promise.all([
        api.request('/v5/observe/overview', { data: { openid } }),
        api.request('/v5/observe/list', { data: { openid, status: 'pending' } }),
        api.request('/v5/observe/due', { data: { openid } })
      ]);
      this.setData({
        overview,
        pendingItems: (pending.items || []).map(item => Object.assign({}, item, {
          actionText: item.ai_verdict ? '看分析' : '一起想'
        })),
        dueItems: due.items || [],
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    } finally {
      this._loading = false;
    }
  },

  onCamera() {
    wx.navigateTo({ url: '/packageCamera/pages/camera/camera' });
  },

  onItemTap(e) {
    const { id, verdict } = e.currentTarget.dataset;
    const page = verdict ? 'verdict' : 'question';
    wx.navigateTo({ url: `/packageShede/pages/${page}/${page}?item_id=${id}` });
  },

  onObserve() {
    wx.switchTab({ url: '/pages/observe/observe' });
  },

  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  onShareAppMessage() {
    return {
      title: '舍得：不替你扔，只帮你想清楚',
      path: '/pages/splash/splash',
      imageUrl: '/assets/images/share-cover.jpg'
    };
  },

  onShareTimeline() {
    return {
      title: '舍得 · 不替你扔，只帮你想清楚',
      path: '/pages/splash/splash',
      imageUrl: '/assets/images/share-cover.jpg'
    };
  }
});
