// 固定代理 DeepInfra：/api/deepinfra?path=/xxx&qs=a=1&b=2
// 例：/api/deepinfra?path=/v1/openai/chat/completions
const BASE = 'https://api.deepinfra.com';

export default async function handler(req, res) {
  // CORS 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // 解析查询参数
    const url = new URL(req.url, 'https://dummy.local'); 
    const path = url.searchParams.get('path') || '/';
    const qs   = url.searchParams.get('qs') || '';
    const target = `${BASE}${path}${qs ? (path.includes('?') ? '&' : '?') + qs : ''}`;

    // 过滤 hop-by-hop 头 + 上游不允许的端到端头
    const hop = new Set([
      'connection','keep-alive','proxy-authenticate','proxy-authorization',
      'te','trailer','transfer-encoding','upgrade'
    ]);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (hop.has(key)) continue;
      if (key === 'host' || key === 'content-length') continue; // 让 fetch 自行设置
      headers[key] = v;
    }

    // 判断是否有请求体
    const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    // 发起上游请求
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      ...(hasBody ? { body: req, duplex: 'half' } : {})
    });

    // 透传上游状态码和响应头
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      if (!hop.has(k.toLowerCase())) res.setHeader(k, v);
    });

    // 返回上游响应数据
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);

  } catch (err) {
    res.status(502).json({ error: 'upstream_error', message: String(err) });
  }
}
