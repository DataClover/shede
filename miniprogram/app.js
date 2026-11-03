// app.js
App({
  /**
   * 全局数据
   */
  globalData: {
    openid: '',
    userInfo: null,
    systemReady: false,
    userDataReady: false,
    // 后台接口基础URL
    // 本机演示用 localhost；真机预览改成电脑的局域网 IP，例如 http://192.168.1.10:8000/
    baseUrl: 'http://localhost:8000/',
    // 演示模式：true = 不调用 wx.login，直接用固定 openid（无需小程序 AppID）
    // 有真实小程序账号后改成 false，即走真实微信登录
    demoMode: true,
    demoOpenid: 'demouser00000000000000000000',
    // 系统信息
    StatusBar: 0,
    CustomBar: 0,
    Custom: null,
    sysNavBar: 0
  },

  /**
   * 小程序启动时触发
   */
  async onLaunch() {
    console.log('小程序启动');
    
    try {
      // 1. 获取系统信息
      await this.getSystemInfo();
      
      // 2. 获取用户openid
      await this.getOpenId();
      
      // 3. 预加载用户基础数据
      await this.preloadUserData();
      
      // 4. 标记系统就绪
      this.globalData.systemReady = true;
      
      // 5. 通知所有等待的页面
      this.notifyPagesReady();
      
      console.log('系统初始化完成');
    } catch (error) {
      console.error('系统初始化失败:', error);
      this.handleInitError(error);
    }
  },

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return new Promise((resolve) => {
      try {
        // 使用新的 API 替代已废弃的 wx.getSystemInfo
        // 获取窗口信息（基础库 2.20.1 开始支持）
        const windowInfo = wx.getWindowInfo();
        this.globalData.StatusBar = windowInfo.statusBarHeight;
        this.globalData.CustomBar = windowInfo.statusBarHeight + 45;
        
        // 获取设备信息以判断平台
        const deviceInfo = wx.getDeviceInfo();
        if (deviceInfo.platform === 'android') {
          this.globalData.CustomBar = windowInfo.statusBarHeight + 50;
        }
        
        // 获取胶囊按钮位置信息
        const custom = wx.getMenuButtonBoundingClientRect();
        this.globalData.Custom = custom;
        this.globalData.CustomBar = custom.bottom + custom.top - windowInfo.statusBarHeight;
        
        console.log('系统信息获取成功:', {
          statusBarHeight: windowInfo.statusBarHeight,
          customBar: this.globalData.CustomBar,
          platform: deviceInfo.platform
        });
        
        resolve(windowInfo);
      } catch (error) {
        console.error('获取系统信息失败:', error);
        // 设置默认值
        this.globalData.StatusBar = 44;
        this.globalData.CustomBar = 88;
        this.globalData.Custom = { bottom: 88, top: 44 };
        resolve({});
      }
    });
  },

  /**
   * 获取用户openid
   */
  async getOpenId() {
    return new Promise((resolve, reject) => {
      // 演示模式：跳过微信登录，直接用固定 openid
      if (this.globalData.demoMode) {
        const demoOpenId = this.globalData.demoOpenid;
        this.globalData.openid = demoOpenId;
        wx.setStorageSync('openid', demoOpenId);
        console.log('[演示模式] 使用固定 openid:', demoOpenId);
        resolve(demoOpenId);
        return;
      }

      // 先检查本地存储
      const localOpenId = wx.getStorageSync('openid');
      if (localOpenId) {
        console.log('从本地存储获取到openid:', localOpenId);
        this.globalData.openid = localOpenId;
        resolve(localOpenId);
        return;
      }

      //console.log('开始获取微信登录code');
      // 登录获取code
      wx.login({
        success: (res) => {
          if (res.code) {
            //console.log('获取到微信登录code:', res.code);
            // 发送code到后台换取openid
            this.exchangeOpenId(res.code)
              .then((openid) => {
                //console.log('成功获取到openid:', openid);
                this.globalData.openid = openid;
                // 保存到本地存储
                wx.setStorageSync('openid', openid);
                resolve(openid);
              })
              .catch((error) => {
                console.error('获取openid失败:', error);
                reject(error);
              });
          } else {
            console.error('微信登录失败，未获取到code');
            reject(new Error('登录失败'));
          }
        },
        fail: (error) => {
          console.error('微信登录调用失败:', error);
          reject(error);
        }
      });
    });
  },

  /**
   * 向后台发送code换取openid
   */
  exchangeOpenId(code) {
    return new Promise((resolve, reject) => {
      //console.log('向后台发送登录请求，code:', code);
      
      wx.request({
        url: this.globalData.baseUrl + 'auth/login',
        method: 'POST',
        header: {
          'content-type': 'application/json'
        },
        data: {
          code: code
        },
        success: (res) => {
          //console.log('后台登录接口响应:', res);
          
          if (res.statusCode === 200 && res.data && res.data.openid) {
            console.log('成功从后台获取openid:', res.data.openid);
            resolve(res.data.openid);
          } else {
            console.error('后台返回数据格式错误或无openid:', res.data);
            reject(new Error('获取openid失败: ' + JSON.stringify(res.data)));
          }
        },
        fail: (error) => {
          console.error('请求后台登录接口失败:', error);
          reject(error);
        }
      });
    });
  },

  /**
   * 预加载用户基础数据
   */
  async preloadUserData() {
    const baseUrl = this.globalData.baseUrl.replace(/\/+$/, '');
    const openid = this.globalData.openid;
    const userData = await new Promise((resolve, reject) => {
      wx.request({
        url: `${baseUrl}/v0/home/info?openid=${encodeURIComponent(openid)}`,
        method: 'GET',
        success: res => {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data.data || {});
          } else {
            reject(new Error('用户初始化失败'));
          }
        },
        fail: () => reject(new Error('无法连接后端，请确认服务已启动'))
      });
    });
    this.globalData.userInfo = userData.user_info || null;
    this.globalData.userDataReady = true;
  },

  /**
   * 通知页面系统就绪
   */
  notifyPagesReady() {
    // 通过事件总线通知所有页面
    if (this.systemReadyCallbacks) {
      this.systemReadyCallbacks.forEach(callback => {
        if (typeof callback === 'function') {
          callback();
        }
      });
      this.systemReadyCallbacks = [];
    }
  },

  /**
   * 注册系统就绪回调
   */
  registerSystemReadyCallback(callback) {
    if (this.globalData.systemReady) {
      callback();
    } else {
      if (!this.systemReadyCallbacks) {
        this.systemReadyCallbacks = [];
      }
      this.systemReadyCallbacks.push(callback);
    }
  },

  /**
   * 处理初始化错误
   */
  handleInitError(error) {
    console.error('系统初始化错误:', error);
    
    // 显示错误提示
    wx.showModal({
      title: '初始化失败',
      content: '系统初始化失败，请检查网络连接后重试',
      showCancel: false,
      confirmText: '重试',
      success: () => {
        // 重新启动初始化流程
        this.onLaunch();
      }
    });
  },

  /**
   * 小程序显示时触发
   */
  onShow() {

  },

  /**
   * 小程序隐藏时触发
   */
  onHide() {
    console.log('小程序隐藏');
  }
});