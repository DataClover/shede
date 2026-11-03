function openid() {
  const globalData = getApp().globalData;
  return globalData.openid || wx.getStorageSync('openid') || '';
}

function request(path, options) {
  const opts = options || {};
  const method = (opts.method || 'GET').toUpperCase();
  const data = opts.data || null;
  const baseUrl = getApp().globalData.baseUrl.replace(/\/+$/, '');
  let url = baseUrl + '/' + String(path).replace(/^\/+/, '');

  if (method === 'GET' && data) {
    const query = Object.keys(data)
      .filter(key => data[key] !== undefined && data[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
      .join('&');
    if (query) url += (url.includes('?') ? '&' : '?') + query;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      header: { 'content-type': 'application/json' },
      data: method === 'GET' ? undefined : data,
      success(res) {
        const body = res.data;
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.status !== 'error') {
          resolve(body.data !== undefined ? body.data : body);
          return;
        }
        const detail = body && (body.detail || body.message);
        reject(new Error(typeof detail === 'string' ? detail : `请求失败 ${res.statusCode}`));
      },
      fail(error) {
        reject(new Error('网络错误：' + (error.errMsg || '请确认后端已启动')));
      }
    });
  });
}

function toastError(error) {
  wx.showToast({
    title: (error && error.message) || '出错了',
    icon: 'none',
    duration: 2500
  });
}

module.exports = { request, openid, toastError };
