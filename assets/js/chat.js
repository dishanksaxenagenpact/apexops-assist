/* ============================================================
 *  ApexAssist · ITOps Co-pilot — Live Claude Sonnet 4.5 via Bedrock
 *
 *  ⚠️  SECURITY WARNING ⚠️
 *  These AWS credentials are embedded in client-side JS for hackathon
 *  demo purposes only. THEY ARE VISIBLE TO ANYONE WHO VIEWS THE PAGE.
 *  • Rotate the IAM access key immediately after the demo.
 *  • For production, replace `callBedrock()` with a call to a backend
 *    proxy (Cloudflare Worker / Lambda Function URL) that holds the
 *    credentials server-side.
 *
 *  CORS NOTE: Bedrock Runtime does not return CORS headers, so direct
 *  browser→Bedrock calls fail on https://*.github.io. You can:
 *    A) Test locally via `python3 -m http.server` (still fails CORS,
 *       but easier to swap to the proxy below)
 *    B) Deploy the Cloudflare Worker in `infra/bedrock-proxy.js` and
 *       set window.AA_CHAT_PROXY = "<your worker url>" before this
 *       script loads — that path uses the proxy, no CORS issues.
 * ============================================================ */

(function () {
  'use strict';

  // ---------- Config ----------
  const REGION = (window.AA_AWS && window.AA_AWS.region) || 'us-east-1';
  const MODEL_ID = (window.AA_AWS && window.AA_AWS.modelId) || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
  const AWS_ACCESS_KEY_ID     = (window.AA_AWS && window.AA_AWS.accessKeyId) || '';
  const AWS_SECRET_ACCESS_KEY = (window.AA_AWS && window.AA_AWS.secretAccessKey) || '';
  const PROXY_URL = window.AA_CHAT_PROXY || ''; // e.g. https://your-worker.workers.dev
  const SYSTEM_PROMPT =
    "You are ApexAssist, an autonomous ITOps co-pilot built by Team ApexOps for the Genpact GenAI Hackathon 2026. " +
    "You orchestrate seven specialist agents (Monitoring, Triage, RCA, Self Heal, Validator, Smart Notify, Learning Engine) " +
    "to detect, diagnose, remediate and learn from production incidents. " +
    "Style: concise, premium, technical — like a senior SRE who has read every runbook. " +
    "When the user describes an incident, briefly walk through how the agent network would respond (which agents fire, what tools they call, what the SLO gate checks). " +
    "When asked about safety: mention OPA policy, human gates, PII redaction, immutable audit log. " +
    "Keep answers under ~6 sentences unless asked for depth. Use crisp bullets when listing steps.";

  // ---------- Web Crypto SigV4 (browser-native, no SDK needed) ----------
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
  function amzDate() {
    const d = new Date();
    const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, '');
    return { full: iso, short: iso.slice(0,8) };
  }
  async function signAndSend({region, service, host, path, payload}) {
    const {full, short} = amzDate();
    const payloadStr = JSON.stringify(payload);
    const payloadHash = await sha256Hex(payloadStr);
    const canonicalHeaders =
      `content-type:application/json\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${full}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest =
      `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${short}/${region}/${service}/aws4_request`;
    const stringToSign =
      `AWS4-HMAC-SHA256\n${full}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

    const kDate    = await hmac(enc.encode('AWS4' + AWS_SECRET_ACCESS_KEY), short);
    const kRegion  = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, 'aws4_request');
    const signature = toHex(await hmac(kSigning, stringToSign));

    const auth = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(`https://${host}${path}`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': full,
        'X-Amz-Content-Sha256': payloadHash,
        'Authorization': auth,
      },
      body: payloadStr,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Bedrock ${res.status}: ${errText.slice(0,200)}`);
    }
    return res.json();
  }

  async function callBedrock(messages) {
    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: messages,
      temperature: 0.6,
    };

    // Path A: Via Cloudflare Worker / Lambda proxy (recommended)
    if (PROXY_URL) {
      const r = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ modelId: MODEL_ID, body }),
      });
      if (!r.ok) throw new Error(`Proxy ${r.status}: ${await r.text()}`);
      const data = await r.json();
      return extractText(data);
    }

    // Path B: Direct browser → Bedrock (works only with CORS-relaxed env)
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('No credentials. Set window.AA_CHAT_PROXY (recommended) or window.AA_AWS = {accessKeyId, secretAccessKey} before loading chat.js.');
    }
    const host = `bedrock-runtime.${REGION}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(MODEL_ID)}/invoke`;
    const data = await signAndSend({region: REGION, service: 'bedrock', host, path, payload: body});
    return extractText(data);
  }

  function extractText(data) {
    // Bedrock Anthropic Messages format: { content: [{type:'text', text:'...'}], ... }
    if (data && Array.isArray(data.content)) {
      return data.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    }
    if (data && data.output_text) return data.output_text;
    return JSON.stringify(data).slice(0, 800);
  }

  // ---------- UI ----------
  const fab = document.createElement('button');
  fab.className = 'aa-chat-fab';
  fab.setAttribute('aria-label', 'Open ApexAssist chat');
  fab.innerHTML = '⬡';

  const panel = document.createElement('div');
  panel.className = 'aa-chat-panel';
  panel.innerHTML = `
    <div class="aa-chat-header">
      <div class="aa-chat-mark">⬡</div>
      <div class="aa-chat-title">
        <b>ApexAssist Co-pilot</b>
        <span>CLAUDE SONNET 4.5 · LIVE</span>
      </div>
      <button class="aa-chat-close" aria-label="Close">×</button>
    </div>
    <div class="aa-chat-body" id="aa-body"></div>
    <div class="aa-chat-suggestions" id="aa-suggest">
      <button data-prompt="orders-api p95 spiked 3.2× after the 14:02 deploy — walk me through how ApexAssist handles it.">orders-api latency spike</button>
      <button data-prompt="Show me the safety guardrails before Self Heal can run kubectl rollout undo.">safety guardrails</button>
      <button data-prompt="How do you ground RCA hypotheses to prevent hallucination?">RCA grounding</button>
    </div>
    <div class="aa-chat-input">
      <textarea id="aa-input" rows="1" placeholder="Ask the co-pilot about an incident…"></textarea>
      <button class="aa-chat-send" id="aa-send" aria-label="Send">➤</button>
    </div>
    <div class="aa-chat-foot">Powered by <b>Claude Sonnet 4.5</b> on AWS Bedrock · simulated tool-use</div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const $body  = panel.querySelector('#aa-body');
  const $input = panel.querySelector('#aa-input');
  const $send  = panel.querySelector('#aa-send');
  const $close = panel.querySelector('.aa-chat-close');
  const $suggest = panel.querySelector('#aa-suggest');

  // Minimal, safe markdown renderer for bot bubbles.
  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function mdToHtml(src) {
    const lines = escapeHtml(src).split('\n');
    const out = [];
    let inUl = false, inOl = false;
    const closeLists = () => {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };
    const inline = (s) => s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>')
      .replace(/\b(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
      const ul = line.match(/^\s*[-*•]\s+(.*)$/);
      if (ol) {
        if (!inOl) { closeLists(); out.push('<ol>'); inOl = true; }
        out.push(`<li>${inline(ol[2])}</li>`);
      } else if (ul) {
        if (!inUl) { closeLists(); out.push('<ul>'); inUl = true; }
        out.push(`<li>${inline(ul[1])}</li>`);
      } else if (line.trim() === '') {
        closeLists();
        out.push('');
      } else {
        closeLists();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    closeLists();
    return out.join('\n');
  }

  function addMessage(role, text, isError) {
    const msg = document.createElement('div');
    msg.className = 'aa-msg ' + (role === 'user' ? 'aa-user' : (isError ? 'aa-bot aa-error' : 'aa-bot'));
    msg.innerHTML = `
      <div class="aa-avatar">${role === 'user' ? 'You' : '⬡'}</div>
      <div class="aa-bubble"></div>
    `;
    const bubble = msg.querySelector('.aa-bubble');
    if (role === 'user') {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = mdToHtml(text);
    }
    $body.appendChild(msg);
    $body.scrollTop = $body.scrollHeight;
    return msg;
  }

  function addTyping() {
    const msg = document.createElement('div');
    msg.className = 'aa-msg aa-bot';
    msg.innerHTML = `<div class="aa-avatar">⬡</div><div class="aa-bubble"><div class="aa-typing"><span></span><span></span><span></span></div></div>`;
    $body.appendChild(msg);
    $body.scrollTop = $body.scrollHeight;
    return msg;
  }

  // Greeting
  addMessage('bot',
    "Hi 👋 I'm ApexAssist — your autonomous ITOps co-pilot, powered by Claude Sonnet 4.5.\n\n" +
    "Describe an incident and I'll show you how the seven-agent fabric (Monitoring → Triage → RCA → Self Heal → Validator → Notify → Learn) would resolve it end-to-end.");

  const history = [];

  function open()  { panel.classList.add('aa-open'); $input.focus(); }
  function close() { panel.classList.remove('aa-open'); }
  fab.addEventListener('click', () => panel.classList.contains('aa-open') ? close() : open());
  $close.addEventListener('click', close);

  async function send(text) {
    text = (text || '').trim();
    if (!text) return;
    addMessage('user', text);
    history.push({ role: 'user', content: [{type:'text', text}] });
    $input.value = '';
    $send.disabled = true;
    const typing = addTyping();
    try {
      const reply = await callBedrock(history);
      typing.remove();
      addMessage('bot', reply || '(empty response)');
      history.push({ role: 'assistant', content: [{type:'text', text: reply}] });
      // Trim history
      if (history.length > 14) history.splice(0, history.length - 14);
    } catch (err) {
      typing.remove();
      const m = String(err.message || err);
      let friendly = m;
      if (/CORS|Failed to fetch|TypeError/i.test(m)) {
        friendly = "Couldn't reach Bedrock directly — the browser blocked the request (CORS).\n" +
                   "Set window.AA_CHAT_PROXY to your Cloudflare Worker URL (see infra/bedrock-proxy.js) and reload.\n\nRaw: " + m;
      }
      addMessage('bot', friendly, true);
      console.error('[ApexAssist chat]', err);
    } finally {
      $send.disabled = false;
      $input.focus();
    }
  }

  $send.addEventListener('click', () => send($input.value));
  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send($input.value); }
  });
  $input.addEventListener('input', () => {
    $input.style.height = 'auto';
    $input.style.height = Math.min(120, $input.scrollHeight) + 'px';
  });
  $suggest.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-prompt]');
    if (b) send(b.dataset.prompt);
  });
})();
