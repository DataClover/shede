// packageShede/pages/dispose/dispose.js
// 处理建议页：卖 / 送 / 回收 / 丢，给能照着做的一步
const api = require('../../utils/api.js');

const CHANNELS = [
  { key: 'sell', label: '卖掉' },
  { key: 'gift', label: '送人' },
  { key: 'recycle', label: '回收' },
  { key: 'discard', label: '丢掉' }
];

Page({
  data: {
    itemId: 0,
    channel: 'sell',
    channels: CHANNELS,
    suggest: null,
    loading: true,
    marking: false
  },

  onLoad(options) {
    const itemId = parseInt(options.item_id || 0, 10);
    const channel = options.channel || 'sell';
    this.setData({ itemId, channel });
    this.load(channel);
  },

  async load(channel) {
    this.setData({ loading: true });
    try {
      const data = await api.request('/v5/dispose/suggest', {
        data: { openid: api.openid(), item_id: this.data.itemId, channel }
      });
      this.setData({ suggest: data.suggest, loading: false, channel });
    } catch (e) {
      this.setData({ loading: false });
      api.toastError(e);
    }
  },

  onSwitchChannel(e) {
    const channel = e.currentTarget.dataset.key;
    if (channel === this.data.channel) return;
    this.load(channel);
  },

  onCopy() {
    const s = this.data.suggest;
    if (!s) return;
    const text = [s.title_text, s.body_text].filter(Boolean).join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '文案已复制', icon: 'success' })
    });
  },

  // 标记已处理：卖/送/回收/丢 各落对应 decision
  async onDone() {
    if (this.data.marking) return;
    this.setData({ marking: true });
    const decision = this.data.channel === 'discard' ? 'discard' : this.data.channel;
    try {
      await api.request('/v5/decision/choose', {
        data: { openid: api.openid(), item_id: this.data.itemId, decision }
      });
      wx.showToast({ title: '已记为「已处理」', icon: 'success' });
      setTimeout(() => wx.redirectTo({ url: '/packageShede/pages/observe/observe' }), 900);
    } catch (e) {
      api.toastError(e);
    } finally {
      this.setData({ marking: false });
    }
  }
});