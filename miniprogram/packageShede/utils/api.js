// packageShede/utils/api.js
// 舍得决策层的统一请求helper：自动拼 baseUrl、带 openid、统一错误提示
const app = getApp();

function openid() {
  const g = getApp().globalData;
  return g.openid || wx.getStorageSync('openid') || '';
}

function request(path, options) {
  options = options || {};
  const baseUrl = getApp().globalData.baseUrl;
  let url = baseUrl + path;
  const data = options.data || null;
  const method = options.method || (data ? 'POST' : 'GET');

  // GET 且带 query 参数时拼到 url 上
  if (method === 'GET' && data) {
    const qs = Object.keys(data)
      .map(k => k + '=' + encodeURIComponent(data[k]))
      .join('&');
    url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      header: { 'content-type': 'application/json' },
      data: method === 'GET' ? undefined : data,
      success(res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data.data !== undefined ? res.data.data : res.data);
        } else {
          const msg = (res.data && (res.data.detail || res.data.message)) || ('请求失败 ' + res.statusCode);
          reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
        }
      },
      fail(err) {
        reject(new Error('网络错误：' + (err.errMsg || '请求失败')));
      }
    });
  });
}

function toastError(e) {
  wx.showToast({ title: (e && e.message) || '出错了', icon: 'none', duration: 2500 });
}

module.exports = { request, openid, toastError };
