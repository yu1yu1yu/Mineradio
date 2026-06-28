/**
 * Mineradio Capacitor Music Plugin
 *
 * 替代 server.js 的 API 代理层，直接调用网易云/QQ 音乐上游 API。
 * 前端通过 window.MinMusicApi 调用。
 */
import { CapacitorHttp, CapacitorCookies } from '@capacitor/core';

// ─── 常量 ───
const NETEASE_API = 'https://music.163.com';
const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg';

// ─── 工具 ───

/** 读取网易云 cookie */
async function getNeteaseCookie() {
  const cookies = await CapacitorCookies.getCookies();
  return Object.entries(cookies)
    .filter(([k]) => k.startsWith('MUSIC_') || k === '__csrf')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** 读取 QQ 音乐 cookie */
async function getQQCookie() {
  const cookies = await CapacitorCookies.getCookies({ url: 'https://y.qq.com' });
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** 通用 POST 请求（QQ 音乐 musicu.fcg） */
async function qqMusicRequest(mod, method, params = {}) {
  const body = { comm: { ct: 24, cv: 0 }, [mod]: { module: mod.split('.')[0], method, param: params } };
  const { data } = await CapacitorHttp.post({
    url: QQ_MUSICU_URL,
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://y.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    data: body,
    responseType: 'json',
  });
  return data?.[mod] || data;
}

// ─── 网易云 API ───

/** 搜索 */
async function neteaseSearch(keywords, limit = 30, offset = 0) {
  const cookie = await getNeteaseCookie();
  const { data } = await CapacitorHttp.post({
    url: `${NETEASE_API}/weapi/cloudsearch/get/web`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': NETEASE_API,
      'Cookie': cookie,
    },
    data: { keywords, limit, offset, type: 1 },
    responseType: 'json',
  });
  return data?.result?.songs || [];
}

/** 获取歌曲 URL */
async function neteaseSongUrl(id, level = 'standard') {
  const cookie = await getNeteaseCookie();
  const { data } = await CapacitorHttp.get({
    url: `${NETEASE_API}/api/song/enhance/player/url/v1`,
    headers: { 'Cookie': cookie, 'Referer': NETEASE_API },
    params: { ids: `[${id}]`, level, encodeType: 'flac' },
    responseType: 'json',
  });
  return data?.data?.[0] || null;
}

/** 歌词 */
async function neteaseLyric(id) {
  const cookie = await getNeteaseCookie();
  const { data } = await CapacitorHttp.get({
    url: `${NETEASE_API}/api/song/lyric`,
    headers: { 'Cookie': cookie },
    params: { id, lv: 1, tv: 1 },
    responseType: 'json',
  });
  return data?.lrc?.lyric || '';
}

/** 评论 */
async function neteaseComments(id, limit = 20) {
  const cookie = await getNeteaseCookie();
  const { data } = await CapacitorHttp.get({
    url: `${NETEASE_API}/api/v1/resource/comments/R_SO_4_${id}`,
    headers: { 'Cookie': cookie },
    params: { limit, offset: 0 },
    responseType: 'json',
  });
  return data?.comments || [];
}

// ─── QQ 音乐 API ───

/** 搜索 */
async function qqSearch(keywords, limit = 30) {
  const { data } = await CapacitorHttp.get({
    url: QQ_SMARTBOX_URL,
    headers: { 'Referer': 'https://y.qq.com/' },
    params: { format: 'json', p: 'android', q: keywords, t: 'all', n: limit },
    responseType: 'json',
  });
  return data?.data?.song?.list || [];
}

/** 获取歌曲播放 URL */
async function qqSongUrl(mid, guid) {
  const cookie = await getQQCookie();
  const { data } = await qqMusicRequest('vkey.GetVkeyServer', 'CgiGetVkey', {
    guid: guid || String(Math.floor(Math.random() * 1e10)),
    songmid: [mid],
    songtype: [0],
    uin: '0',
    loginflag: 1,
    platform: '20',
  });
  return data?.midurlinfo?.[0]?.purl || '';
}

/** 歌词 */
async function qqLyric(songmid) {
  const { data } = await CapacitorHttp.get({
    url: 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg',
    headers: { 'Referer': 'https://y.qq.com/' },
    params: { format: 'json', songmid, nobase64: 1 },
    responseType: 'json',
  });
  return data?.lyric || '';
}

// ─── 导出到 window ───
const MinMusicApi = {
  // 网易云
  neteaseSearch,
  neteaseSongUrl,
  neteaseLyric,
  neteaseComments,
  // QQ
  qqSearch,
  qqSongUrl,
  qqLyric,
  // 工具
  getNeteaseCookie,
  getQQCookie,
  CapacitorCookies,
};

// 挂载到 window 供前端使用
if (typeof window !== 'undefined') {
  window.MinMusicApi = MinMusicApi;
}

export default MinMusicApi;
