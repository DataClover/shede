const app = getApp();

Page({
  data: {
    imagePath: '',
    recognitionResult: null,
    itemInfo: {
      name: '',
      description: '',
      category: '',
      tags: []
    },
    categories: [
      '服装配饰', '床上用品', '家居用品', '电子设备', '生活用品',
      '化妆用品', '食品饮料', '书籍资料', '工具用品', '文具用品',
      '运动用品', '玩具游戏', '其他'
    ],
    commonTags: ['重要', '常用', '备用', '新品', '二手', '易碎', '贵重', '临时', '待处理', '收藏'],
    categoryIndex: 0,
    customTagInput: '',
    submitting: false
  },

  onLoad(options) {
    const imagePath = decodeURIComponent(options.image || '');
    let recognitionResult = {};
    try {
      recognitionResult = JSON.parse(decodeURIComponent(options.result || '{}'));
    } catch (error) {
      console.error('解析识别结果失败:', error);
    }

    const analysisResult = (recognitionResult.data && recognitionResult.data.analysis_result) ||
      recognitionResult.analysis_result || recognitionResult;
    const tags = Array.isArray(analysisResult.tags)
      ? analysisResult.tags.map(tag => typeof tag === 'object' ? tag.name : tag).filter(Boolean)
      : [];
    const category = analysisResult.category || '其他';
    const categoryIndex = Math.max(0, this.data.categories.indexOf(category));

    this.setData({
      imagePath,
      recognitionResult,
      categoryIndex,
      itemInfo: {
        name: analysisResult.name || '',
        description: analysisResult.description || '',
        category,
        tags
      }
    });
  },

  onInputChange(e) {
    this.setData({ [`itemInfo.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    this.setData({
      categoryIndex,
      'itemInfo.category': this.data.categories[categoryIndex]
    });
  },

  onAddTag(e) {
    const { tag } = e.currentTarget.dataset;
    const { tags } = this.data.itemInfo;
    if (!tags.includes(tag)) {
      this.setData({ 'itemInfo.tags': [...tags, tag] });
    }
  },

  onRemoveTag(e) {
    const tags = this.data.itemInfo.tags.filter((tag, index) => index !== e.currentTarget.dataset.index);
    this.setData({ 'itemInfo.tags': tags });
  },

  onCustomTagInput(e) {
    this.setData({ customTagInput: e.detail.value });
  },

  onAddCustomTag(e) {
    const tag = e.detail.value.trim();
    if (!tag) return;
    const { tags } = this.data.itemInfo;
    if (tags.includes(tag)) {
      wx.showToast({ title: '标签已存在', icon: 'none' });
      return;
    }
    this.setData({ 'itemInfo.tags': [...tags, tag], customTagInput: '' });
  },

  onRetakePhoto() {
    wx.navigateBack();
  },

  addItem(requestData) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: app.globalData.baseUrl.replace(/\/+$/, '') + '/v3/item/add',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: requestData,
        success: res => {
          if (res.statusCode === 200 && res.data && res.data.status === 'success') {
            resolve(res.data);
          } else {
            const detail = res.data && (res.data.message || res.data.detail);
            reject(new Error(typeof detail === 'string' ? detail : '没能保存，请再试一次'));
          }
        },
        fail: () => reject(new Error('没连上服务，请确认后端已启动'))
      });
    });
  },

  async onSubmit() {
    const { itemInfo, recognitionResult, submitting } = this.data;
    if (submitting) return;
    if (!itemInfo.name.trim()) {
      wx.showToast({ title: '先给它起个名字吧', icon: 'none' });
      return;
    }
    if (!itemInfo.category) {
      wx.showToast({ title: '选一个最接近的分类', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...' });
    try {
      const imageFilename = (recognitionResult && recognitionResult.data && recognitionResult.data.image_filename) ||
        (recognitionResult && recognitionResult.image_filename) || '';
      const result = await this.addItem({
        openid: app.globalData.openid,
        title: itemInfo.name.trim(),
        description: itemInfo.description || '',
        category: itemInfo.category,
        image_filename: imageFilename,
        tags: itemInfo.tags || []
      });
      const itemId = result.data && result.data.item_info && result.data.item_info.item_id;
      if (!itemId) throw new Error('保存成功但未返回物品 ID');

      wx.hideLoading();
      wx.redirectTo({
        url: `/packageShede/pages/question/question?item_id=${itemId}`
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '没能保存，请再试一次', icon: 'none' });
      this.setData({ submitting: false });
    }
  }
});
