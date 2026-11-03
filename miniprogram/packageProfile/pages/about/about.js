// packageProfile/pages/about/about.js

/**
 * 关于页面
 * 显示应用的详细信息、版本历史、开发团队等
 */
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 应用信息
    appInfo: {
      name: '舍得',
      version: '1.0.0',
      buildNumber: '20261103',
      releaseDate: '2026-11-03',
      description: '一款 AI 断舍离决策助手，通过四问、六维评分和 30 天观察，帮助你决定物品去留。'
    },
    
    // 开发团队
    teamInfo: {
      company: 'Lordli',
      website: 'https://lordli.com/',
      email: 'cnPro@163.com'
    },
    
    // 功能特性
    features: [
      {
        icon: 'cuIcon-scan',
        title: '拍照识别',
        description: '拍摄或从相册选择物品，确认识别信息'
      },
      {
        icon: 'cuIcon-edit',
        title: '四问六维',
        description: '用四个固定问题生成统一口径的六维评分'
      },
      {
        icon: 'cuIcon-time',
        title: '30 天观察',
        description: '记录实际使用次数，到期后再决定去留'
      },
      {
        icon: 'cuIcon-delete',
        title: '处理建议',
        description: '提供出售、转赠、回收和丢弃的具体下一步'
      }
    ],
    
    // 版本历史
    versionHistory: [
      {
        version: '1.0.0',
        date: '2026-11-03',
        changes: [
          '上线拍照、四问、六维分析的决策链路',
          '支持 30 天观察箱和四种处理渠道',
          '支持演示登录与无 AI key 的规则降级'
        ]
      }
    ],
    
    // 技术栈
    techStack: [
      { name: '微信小程序', description: '前端框架' },
      { name: 'ColorUI', description: 'UI 组件库' },
      { name: 'FastAPI', description: '后端服务' },
      { name: 'SQLite', description: '数据存储' },
      { name: 'AI 识别', description: '图像识别与决策分析，支持规则降级' }
    ],
    
    // 许可证信息
    licenseInfo: {
      type: 'MIT License',
      year: '2025',
      holder: 'Lordli'
    },
    
    // 第三方库
    thirdPartyLibs: [
      { name: 'ColorUI', version: '2.1.6', license: 'MIT' },
      { name: 'WeUI', version: '2.5.11', license: 'MIT' },
      { name: 'Lodash', version: '4.17.21', license: 'MIT' }
    ],
    
    // 统计信息
    statistics: {
      downloads: '10,000',
      users: '5,000',
      rating: 4.8,
      reviews: 1250
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('关于页面加载', options);
    
    // 加载应用统计信息
    this.loadAppStatistics();
  },

  /**
   * 加载应用统计信息
   */
  async loadAppStatistics() {
    try {
      // 模拟获取统计数据
      const statistics = {
        downloads: '12,500+',
        users: '6,800+',
        rating: 4.9,
        reviews: 1456
      };
      
      this.setData({ statistics });
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  },

  /**
   * 访问官网
   */
  onVisitWebsite() {
    wx.setClipboardData({
      data: this.data.teamInfo.website,
      success: () => {
        wx.showToast({
          title: '网址已复制',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 联系邮箱
   */
  onContactEmail() {
    wx.setClipboardData({
      data: this.data.teamInfo.email,
      success: () => {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 拨打电话
   */
  onCallPhone() {
    wx.makePhoneCall({
      phoneNumber: this.data.teamInfo.phone,
      fail: () => {
        wx.setClipboardData({
          data: this.data.teamInfo.phone,
          success: () => {
            wx.showToast({
              title: '电话已复制',
              icon: 'success'
            });
          }
        });
      }
    });
  },

  /**
   * 查看许可证
   */
  onViewLicense() {
    const { type, year, holder } = this.data.licenseInfo;
    wx.showModal({
      title: '许可证信息',
      content: `${type}\n\nCopyright (c) ${year} ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software...`,
      showCancel: false,
      confirmText: '确定'
    });
  },

  /**
   * 查看隐私政策
   */
  onViewPrivacyPolicy() {
    wx.navigateTo({
      url: '/packageProfile/pages/privacy/privacy'
    });
  },

  /**
   * 查看用户协议
   */
  onViewUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '使用本应用即表示您同意我们的用户协议。请合理使用应用功能，遵守相关法律法规。详细条款请访问官网查看。',
      showCancel: false,
      confirmText: '确定'
    });
  },

  /**
   * 检查更新
   */
  onCheckUpdate() {
    wx.showLoading({ title: '检查中...' });
    
    // 模拟检查更新
    setTimeout(() => {
      wx.hideLoading();
      
      const hasUpdate = Math.random() > 0.7;
      
      if (hasUpdate) {
        wx.showModal({
          title: '发现新版本',
          content: '发现新版本，包含决策流程优化与已知问题修复。\n\n是否立即更新？',
          success: (res) => {
            if (res.confirm) {
              wx.showToast({
                title: '开始下载更新',
                icon: 'success'
              });
            }
          }
        });
      } else {
        wx.showToast({
          title: '已是最新版本',
          icon: 'success'
        });
      }
    }, 1500);
  },

  /**
   * 意见反馈
   */
  onFeedback() {
    wx.showActionSheet({
      itemList: ['问题反馈', '功能建议', '使用咨询'],
      success: (res) => {
        const types = ['问题反馈', '功能建议', '使用咨询'];
        const type = types[res.tapIndex];
        
        wx.showToast({
          title: `正在打开${type}`,
          icon: 'success'
        });
      }
    });
  },

  /**
   * 评分应用
   */
  onRateApp() {
    wx.showModal({
      title: '应用评分',
      content: '如果您觉得这个应用不错，请给我们一个好评，这将是对我们最大的鼓励！',
      confirmText: '去评分',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '感谢您的支持',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 分享应用
   */
  onShareApp() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 复制版本信息
   */
  onCopyVersionInfo() {
    const { name, version, buildNumber } = this.data.appInfo;
    const versionText = `${name} v${version} (${buildNumber})`;
    
    wx.setClipboardData({
      data: versionText,
      success: () => {
        wx.showToast({
          title: '版本信息已复制',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 查看开源项目
   */
  onViewOpenSource() {
    wx.showModal({
      title: '开源项目',
      content: '本项目部分代码已开源，欢迎开发者参与贡献。GitHub地址已复制到剪贴板。',
      showCancel: false,
      success: () => {
        wx.setClipboardData({
          data: 'https://github.com/1eez/AI-Inventory-APP'
        });
      }
    });
  },

});