const app = getApp();

Page({
  data: {
    userInfo: {},
    editingNickname: false,
    editNickname: '',
    settingsOptions: [
      {
        id: 'demo',
        title: '演示模式',
        subtitle: '演示登录与 AI 连接说明',
        icon: 'cuIcon-info',
        color: '#4facfe'
      }
    ],
    otherOptions: [
      { id: 'privacy', title: '隐私政策', subtitle: '了解隐私保护', icon: 'cuIcon-lock', color: '#4facfe' },
      { id: 'help', title: '使用帮助', subtitle: '决策流程和常见问题', icon: 'cuIcon-question', color: '#4facfe' },
      { id: 'about', title: '关于', subtitle: '版本信息', icon: 'cuIcon-info', color: '#4facfe' }
    ],
    loading: true,
    skeletonLoading: true
  },

  onLoad() {
    if (app.globalData.systemReady) {
      this.initPage();
    } else {
      app.registerSystemReadyCallback(() => this.initPage());
    }
  },

  onShow() {
    if (!this.data.loading) this.loadUserData();
  },

  async initPage() {
    try {
      await this.loadUserData();
      this.setData({ loading: false, skeletonLoading: false });
    } catch (error) {
      this.setData({ loading: false, skeletonLoading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  async loadUserData() {
    let userInfo = app.globalData.userInfo || {};
    if (!userInfo.nickname) {
      const homeData = await this.fetchUserHomeData();
      userInfo = homeData.data && homeData.data.user_info || {};
      app.globalData.userInfo = userInfo;
    }
    this.setData({ userInfo });
  },

  fetchUserHomeData() {
    const baseUrl = app.globalData.baseUrl.replace(/\/+$/, '');
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${baseUrl}/v0/home/info?openid=${encodeURIComponent(app.globalData.openid)}`,
        method: 'GET',
        success: res => {
          if (res.statusCode === 200 && res.data) resolve(res.data);
          else reject(new Error('用户信息加载失败'));
        },
        fail: () => reject(new Error('网络请求失败'))
      });
    });
  },

  startEditNickname() {
    this.setData({
      editingNickname: true,
      editNickname: this.data.userInfo.nickname || ''
    });
  },

  onNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  cancelEditNickname() {
    this.setData({ editingNickname: false, editNickname: '' });
  },

  async confirmEditNickname() {
    const nickname = this.data.editNickname.trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中...' });
    try {
      await this.updateNickname(nickname);
      const userInfo = Object.assign({}, this.data.userInfo, { nickname });
      app.globalData.userInfo = userInfo;
      this.setData({ userInfo, editingNickname: false, editNickname: '' });
      wx.showToast({ title: '昵称已修改', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '修改失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  updateNickname(nickname) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: app.globalData.baseUrl.replace(/\/+$/, '') + '/v0/user/edit_nickname',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { openid: app.globalData.openid, nickname },
        success: res => {
          if (res.statusCode === 200 && res.data && res.data.status === 'success') resolve(res.data);
          else reject(new Error(res.data && res.data.message || '修改昵称失败'));
        },
        fail: () => reject(new Error('网络请求失败'))
      });
    });
  },

  onSettingTap() {
    wx.navigateTo({ url: '/packageProfile/pages/settings/settings' });
  },

  onOtherTap(e) {
    const id = e.currentTarget.dataset.id;
    if (['privacy', 'help', 'about'].includes(id)) {
      wx.navigateTo({ url: `/packageProfile/pages/${id}/${id}` });
    }
  },

  async onPullDownRefresh() {
    try {
      await this.loadUserData();
    } catch (error) {
      wx.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
    }
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
