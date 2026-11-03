const api = require('../../../utils/api.js');

const ORDER = ['usage', 'duplicate', 'need', 'rebuy', 'space', 'emotion'];
const LABELS = {
  usage: '使用频率',
  duplicate: '是否重复',
  need: '实际需求',
  rebuy: '重新购买意愿',
  space: '占用空间',
  emotion: '情感价值'
};
const DECISIONS = {
  keep: '留下',
  observe: '观察 30 天',
  sell: '出售',
  gift: '转赠',
  recycle: '回收',
  discard: '丢弃'
};

Page({
  data: {
    itemId: 0,
    item: {},
    dims: [],
    imageUrl: '',
    statusText: '待决策',
    decisionText: '',
    loading: true
  },

  onLoad(options) {
    this.setData({ itemId: parseInt(options.item_id || options.itemId || 0, 10) });
  },

  onShow() {
    if (this.data.itemId) this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const data = await api.request('/v5/decision/item', {
        data: { openid: api.openid(), item_id: this.data.itemId }
      });
      const item = data.item || {};
      const dims = data.dims ? ORDER.map(key => ({
        key,
        name: LABELS[key],
        value: Math.max(0, Math.min(100, Number(data.dims[key] === undefined ? 50 : data.dims[key])))
      })) : [];
      const imageUrl = item.image_filename
        ? getApp().globalData.baseUrl.replace(/\/+$/, '') + '/Photos/' + item.image_filename
        : '';
      this.setData({
        item,
        dims,
        imageUrl,
        statusText: data.status_text || '待决策',
        decisionText: DECISIONS[item.decision] || '',
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    }
  },

  onQuestion() {
    wx.navigateTo({ url: `/packageShede/pages/question/question?item_id=${this.data.itemId}` });
  },

  onVerdict() {
    wx.navigateTo({ url: `/packageShede/pages/verdict/verdict?item_id=${this.data.itemId}` });
  },

  onDispose() {
    const savedChannel = this.data.item.dispose_channel;
    const channel = savedChannel === 'trash' ? 'discard' : (savedChannel ||
      (['sell', 'gift', 'recycle', 'discard'].includes(this.data.item.decision) ? this.data.item.decision : 'sell'));
    wx.navigateTo({
      url: `/packageShede/pages/dispose/dispose?item_id=${this.data.itemId}&channel=${channel}`
    });
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  }
});
