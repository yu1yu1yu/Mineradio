/**
 * Capacitor Fetch Interceptor
 *
 * 拦截前端对 /api/* 的 fetch 请求，转为 CapacitorHttp 调用。
 * 在 index.html 中通过 <script> 引入即可。
 */
(function () {
  if (!window.Capacitor || !window.Capacitor.Plugins?.CapacitorHttp) {
    console.warn('[Mineradio] CapacitorHttp not available, skipping interceptor');
    return;
  }

  const { CapacitorHttp } = window.Capacitor.Plugins;
  const originalFetch = window.fetch;

  // API 路由映射
  const API_ROUTES = {
    '/api/search': handleSearch,
    '/api/song/url': handleSongUrl,
    '/api/lyric': handleLyric,
    '/api/song/comments': handleComments,
    '/api/qq/search': handleQQSearch,
    '/api/qq/song/url': handleQQSongUrl,
    '/api/qq/lyric': handleQQLyric,
    '/api/qq/song/comments': handleQQComments,
    '/api/audio': handleAudioProxy,
    '/api/cover': handleCoverProxy,
    '/api/login/status': handleLoginStatus,
  };

  // ─── 处理函数 ───

  async function handleSearch(params) {
    const keywords = params.get('keywords');
    const source = params.get('source') || 'netease';
    const limit = parseInt(params.get('limit') || '30');

    if (source === 'qq') {
      const songs = await window.MinMusicApi.qqSearch(keywords, limit);
      return { songs, source: 'qq' };
    }

    const songs = await window.MinMusicApi.neteaseSearch(keywords, limit);
    return { songs, source: 'netease' };
  }

  async function handleSongUrl(params) {
    const id = params.get('id');
    const level = params.get('level') || 'standard';
    const urlData = await window.MinMusicApi.neteaseSongUrl(id, level);
    return urlData || { code: 404, message: 'Song URL not found' };
  }

  async function handleLyric(params) {
    const id = params.get('id');
    const lrc = await window.MinMusicApi.neteaseLyric(id);
    return { lrc };
  }

  async function handleComments(params) {
    const id = params.get('id');
    const comments = await window.MinMusicApi.neteaseComments(id);
    return { comments };
  }

  async function handleQQSearch(params) {
    const keywords = params.get('keywords');
    const limit = parseInt(params.get('limit') || '30');
    const songs = await window.MinMusicApi.qqSearch(keywords, limit);
    return { songs };
  }

  async function handleQQSongUrl(params) {
    const mid = params.get('mid');
    const purl = await window.MinMusicApi.qqSongUrl(mid);
    return { url: purl };
  }

  async function handleQQLyric(params) {
    const songmid = params.get('id') || params.get('songmid');
    const lrc = await window.MinMusicApi.qqLyric(songmid);
    return { lrc };
  }

  async function handleQQComments(params) {
    // QQ 评论 API 暂未实现
    return { comments: [] };
  }

  async function handleAudioProxy(params) {
    const url = params.get('url');
    if (!url) return { error: 'Missing url parameter' };

    // 直接返回原始 URL，让前端自行播放
    // Capacitor WebView 可以直接加载跨域音频
    return { url };
  }

  async function handleCoverProxy(params) {
    const url = params.get('url');
    if (!url) return { error: 'Missing url parameter' };
    return { url };
  }

  async function handleLoginStatus() {
    const cookies = await window.Capacitor.CapacitorCookies.getCookies();
    const hasNetease = !!cookies['MUSIC_U'];
    const hasQQ = !!cookies['qm_keyst'] || !!cookies['qqmusic_key'];
    return {
      netease: { loggedIn: hasNetease },
      qq: { loggedIn: hasQQ },
    };
  }

  // ─── 拦截器 ───

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input.url;

    // 只拦截 /api/ 请求
    if (!url.startsWith('/api/')) {
      return originalFetch.call(this, input, init);
    }

    const urlObj = new URL(url, window.location.origin);
    const pathname = urlObj.pathname;
    const params = urlObj.searchParams;

    // 查找匹配的路由
    const handler = API_ROUTES[pathname];
    if (!handler) {
      console.warn(`[Mineradio] No Capacitor handler for ${pathname}`);
      return originalFetch.call(this, input, init);
    }

    try {
      const data = await handler(params);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error(`[Mineradio] API error for ${pathname}:`, err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };

  console.log('[Mineradio] Capacitor fetch interceptor loaded');
})();
