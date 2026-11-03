Page({
  data: {
    demoMode: true,
    demoOpenid: ''
  },

  onLoad() {
    const globalData = getApp().globalData;
    this.setData({
      demoMode: globalData.demoMode,
      demoOpenid: globalData.demoOpenid
    });
  }
});
