// 固定代理 DeepInfra：/api/deepinfra?path=/xxx&qs=a=b
// 或直接 /api/deepinfra 用于首页

const BASE = 'https://deepinfra.com';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const url = new URL(req.url, 'https://dummy.local'); // 只用于解析查询参数
    const path = url.searchParams.get('path') || '/';
    const qs   = url.searchParams.get('qs') || ''; // 传原始查询串，如 "a=1&b=2"
    const target = `${BASE}${path}${qs ? (path.includes('?') ? '&' : '?') + qs : ''}`;

    // 过滤 hop-by-hop 头
    const hop = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (!hop.has(key)) headers[key] = v;
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET','HEAD','OPTIONS'].includes(req.method) ? undefined : req
    });

    res.status(upstream.status);
    upstream.headers.forEach((v, k) => { if (!hop.has(k.toLowerCase())) res.setHeader(k, v); });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', message: String(err) });
  }
}
