const api = require('../../../utils/api.js');

const CHANNELS = [
  { key: 'sell', label: '卖掉' },
  { key: 'gift', label: '送人' },
  { key: 'recycle', label: '回收' },
  { key: 'discard', label: '扔掉' }
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
    const channel = CHANNELS.some(item => item.key === options.channel) ? options.channel : 'sell';
    this.setData({ itemId, channel });
    this.load(channel, true);
  },

  async load(channel, readPlan) {
    this.setData({ loading: true, channel });
    try {
      if (readPlan) {
        try {
          const plan = await api.request('/v5/dispose/plan', {
            data: { openid: api.openid(), item_id: this.data.itemId }
          });
          if (plan.suggest && plan.channel === channel) {
            this.setData({ suggest: plan.suggest, loading: false });
            return;
          }
        } catch (error) {
          console.log('暂无已保存的处理建议，将生成新建议');
        }
      }
      const data = await api.request('/v5/dispose/suggest', {
        method: 'POST',
        data: { openid: api.openid(), item_id: this.data.itemId, channel }
      });
      this.setData({ suggest: data.suggest, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      api.toastError(error);
    }
  },

  onSwitchChannel(e) {
    const channel = e.currentTarget.dataset.key;
    if (channel !== this.data.channel) this.load(channel, false);
  },

  onCopy() {
    const suggest = this.data.suggest;
    if (!suggest) return;
    wx.setClipboardData({
      data: [suggest.title_text, suggest.body_text].filter(Boolean).join('\n'),
      success: () => wx.showToast({ title: '文案复制好了', icon: 'success' })
    });
  },

  async onDone() {
    if (this.data.marking) return;
    this.setData({ marking: true });
    try {
      await api.request('/v5/decision/choose', {
        method: 'POST',
        data: {
          openid: api.openid(),
          item_id: this.data.itemId,
          decision: this.data.channel
        }
      });
      wx.showToast({ title: '好，这件事到此为止了', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/observe/observe' }), 500);
    } catch (error) {
      api.toastError(error);
    } finally {
      this.setData({ marking: false });
    }
  }
});
