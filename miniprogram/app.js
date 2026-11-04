// app.js

const { CANDIDATES } = require('./utils/config.js');

// 后端地址的解析结果只算一次，多个页面共用同一个 Promise
let baseUrlPromise = null;

App({
  /**
   * 全局数据
   */
  globalData: {
    openid: '',
    userInfo: null,
    systemReady: false,
    userDataReady: false,
    // 后端地址：先给候选列表第一个，启动时由 resolveBaseUrl() 探测后覆盖
    baseUrl: CANDIDATES[0] || 'http://localhost:8000/',
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

    // 网络变化（断 Wi-Fi、换网络、路由器重新分配 IP）后重新探测后端地址
    if (wx.onNetworkStatusChange) {
      wx.onNetworkStatusChange((res) => {
        console.log('[app] 网络状态变化', res);
        baseUrlPromise = null;
      });
    }
    
    try {
      // 1. 获取系统信息
      await this.getSystemInfo();
      
      // 2. 探测可用的后端地址（换网络后自动切换）
      await this.resolveBaseUrl();
      
      // 3. 获取用户openid
      await this.getOpenId();
      
      // 4. 预加载用户基础数据
      await this.preloadUserData();
      
      // 5. 标记系统就绪
      this.globalData.systemReady = true;
      
      // 6. 通知所有等待的页面
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
   * 解析后端地址：先试本地缓存的地址，再按顺序探测候选列表
   * 结果只计算一次，页面/工具函数可以重复调用
   */
  resolveBaseUrl() {
    if (!baseUrlPromise) {
      baseUrlPromise = this.detectBaseUrl();
    }
    return baseUrlPromise;
  },

  async detectBaseUrl() {
    const candidates = [];
    const cached = wx.getStorageSync('baseUrl');
    if (cached) candidates.push(cached);
    (CANDIDATES || []).forEach((url) => {
      if (url && candidates.indexOf(url) === -1) candidates.push(url);
    });
    if (!candidates.length) candidates.push('http://localhost:8000/');

    for (let i = 0; i < candidates.length; i++) {
      const url = candidates[i];
      const ok = await this.pingBaseUrl(url);
      console.log('[app] 探测后端地址', url, ok ? 'OK' : '不可用');
      if (ok) {
        this.globalData.baseUrl = url;
        wx.setStorageSync('baseUrl', url);
        return url;
      }
    }

    // 全部不可用：先用第一个，让后续请求把真实错误暴露在启动页上
    this.globalData.baseUrl = candidates[0];
    console.warn('[app] 所有候选地址都不可用，暂用', candidates[0]);
    return candidates[0];
  },

  pingBaseUrl(url) {
    return new Promise((resolve) => {
      wx.request({
        url: url.replace(/\/+$/, '') + '/health',
        method: 'GET',
        timeout: 2500,
        success: (res) => resolve(res.statusCode === 200),
        fail: () => resolve(false)
      });
    });
  },

  /**
   * 手动设置后端地址（启动页连不上时用）
   * 成功返回 true，格式不对返回 false
   */
  setBaseUrl(url) {
    let next = String(url || '').trim();
    if (!next) return false;
    if (!/^https?:\/\//i.test(next)) next = 'http://' + next;
    if (!/^https?:\/\/[^\s/]+/i.test(next)) return false;
    next = next.replace(/\/+$/, '') + '/';

    wx.setStorageSync('baseUrl', next);
    this.globalData.baseUrl = next;
    baseUrlPromise = Promise.resolve(next);
    console.log('[app] 后端地址已设置为', next);
    return true;
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
        timeout: 12000,
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
        timeout: 12000,
        success: res => {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data.data || {});
          } else {
            reject(new Error('用户初始化失败'));
          }
        },
        fail: () => reject(new Error(`连不上后端 ${this.globalData.baseUrl}，请确认服务已启动、手机与电脑在同一 Wi-Fi`))
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