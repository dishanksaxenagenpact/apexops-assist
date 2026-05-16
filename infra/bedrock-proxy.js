/**
 * ApexAssist · Bedrock Proxy (Cloudflare Worker)
 *
 * Deploy in ~60 seconds:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create → "Hello World"
 *   2. Paste this entire file into the editor
 *   3. Save and deploy. Copy the *.workers.dev URL.
 *   4. In your HTML, set:
 *        <script>window.AA_CHAT_PROXY = "https://your-worker.workers.dev";</script>
 *      BEFORE loading /assets/js/chat.js
 *
 * Set the three secrets in the Worker dashboard (Settings → Variables):
 *   AWS_ACCESS_KEY_ID       (Secret)
 *   AWS_SECRET_ACCESS_KEY   (Secret)
 *   AWS_REGION              (Plain text, e.g. us-east-1)
 *
 * Keys NEVER leave the worker — the browser only sees the proxy URL.
 */

export default {
  async fetch(req, env) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
    }

    let payload;
    try { payload = await req.json(); }
    catch { return json({ error: 'bad json' }, 400); }

    const { modelId, body } = payload || {};
    if (!modelId || !body) return json({ error: 'modelId and body required' }, 400);

    const region  = env.AWS_REGION || 'us-east-1';
    const host    = `bedrock-runtime.${region}.amazonaws.com`;
    const path    = `/model/${encodeURIComponent(modelId)}/invoke`;
    const url     = `https://${host}${path}`;
    const bodyStr = JSON.stringify(body);

    const signed = await signV4({
      method: 'POST', url, region, service: 'bedrock',
      accessKey: env.AWS_ACCESS_KEY_ID,
      secretKey: env.AWS_SECRET_ACCESS_KEY,
      headers: { 'content-type': 'application/json', host },
      payload: bodyStr,
    });

    const upstream = await fetch(url, { method: 'POST', headers: signed.headers, body: bodyStr });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
function json(o, status=200) {
  return new Response(JSON.stringify(o), { status, headers: {'Content-Type':'application/json', ...corsHeaders()} });
}

// ---- AWS SigV4 (workers-compatible) ----
const enc = new TextEncoder();
async function hmac(keyBytes, msg) {
  const k = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
async function sha256Hex(s) {
  const h = await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2,'0')).join('');
}
function toHex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2,'0')).join(''); }

async function signV4({ method, url, region, service, accessKey, secretKey, headers, payload }) {
  const u = new URL(url);
  const now = new Date();
  const full = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const short = full.slice(0, 8);
  headers = { ...headers, 'x-amz-date': full, 'host': u.host };
  const payloadHash = await sha256Hex(payload);
  headers['x-amz-content-sha256'] = payloadHash;

  const sortedKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k] ?? headers[Object.keys(headers).find(x=>x.toLowerCase()===k)]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  // SigV4 requires path segments to be URI-encoded TWICE for non-S3 services.
  const canonicalPath = u.pathname.split('/').map(seg => encodeURIComponent(seg)).join('/');
  const canonicalRequest = `${method}\n${canonicalPath}\n${u.search.slice(1)}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${short}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${full}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  const kDate    = await hmac(enc.encode('AWS4' + secretKey), short);
  const kRegion  = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));
  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers };
}
