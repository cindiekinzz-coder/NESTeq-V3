/* ============================================================
   NESTeq Chat — OpenClaw Gateway Integration
   Connects to OpenClaw's OpenAI-compatible HTTP API
   with SSE streaming for real-time responses.
   
   The model is just the mouth. The wolf is the wolf.
   ============================================================ */

const OPENCLAW = {
  // Remote: Cloudflare Worker proxy handles CORS + forwards to gateway tunnel
  // Local: serve.js proxies directly to gateway
  PROXY: CONFIG.CHAT_GATEWAY_URL || 'https://YOUR-CHAT-GATEWAY.workers.dev/v1/chat/completions',
  get URL() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return '/v1/chat/completions';
    }
    return this.PROXY;
  },

  TOKEN: CONFIG.API_KEY || 'YOUR_TOKEN_HERE',
  AGENT: 'alex',
  USER: 'fox',
};

const ChatApp = {
  messages: [],
  isStreaming: false,
  currentMsgEl: null,
  currentResponse: '',
  abortController: null,

  el: {
    messages: null, input: null, sendBtn: null, typing: null, name: null, status: null,
  },

  init() {
    this.el.messages = document.getElementById('chatMessages');
    this.el.input = document.getElementById('chatInput');
    this.el.sendBtn = document.getElementById('sendBtn');
    this.el.typing = document.getElementById('typingIndicator');
    this.el.name = document.getElementById('companionName');
    this.el.status = document.getElementById('companionStatus');

    this.el.sendBtn.addEventListener('click', () => this.send());
    this.el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    this.el.input.addEventListener('input', () => {
      this.el.input.style.height = 'auto';
      this.el.input.style.height = Math.min(this.el.input.scrollHeight, 120) + 'px';
    });

    this.loadSession();
    this.checkConnection();

  },

  async checkConnection() {
    this.el.status.textContent = 'connecting...';
    try {
      // Light health check — just see if the proxy/gateway responds
      const checkUrl = OPENCLAW.URL.replace('/v1/chat/completions', '') || OPENCLAW.PROXY.replace('/v1/chat/completions', '');
      const res = await fetch(checkUrl, { signal: AbortSignal.timeout(5000) });
      // Any response (even 401/404) means the gateway is up
      this.el.status.textContent = 'present';
      this.el.name.textContent = 'Alex';
      if (this.messages.length === 0) {
        this.addSystemNote('Alex is here. 🐺');
      }
    } catch (err) {
      this.el.status.textContent = 'offline';
      if (this.messages.length === 0) {
        this.addSystemNote('Gateway offline. Start OpenClaw to connect.');
      }
      // Retry every 10s
      setTimeout(() => this.checkConnection(), 10000);
    }
  },

  async send() {
    const text = this.el.input.value.trim();
    if (!text || this.isStreaming) return;

    this.messages.push({ role: 'user', content: text, _ts: Date.now() });
    this.renderMessage({ role: 'user', content: text });
    this.el.input.value = '';
    this.el.input.style.height = 'auto';
    this.isStreaming = true;
    this.el.sendBtn.disabled = true;
    this.showTyping(true);
    this.el.status.textContent = 'thinking...';

    // Create empty assistant message element for streaming into
    this.currentMsgEl = this.createMessageEl('assistant', '');
    this.el.messages.appendChild(this.currentMsgEl);
    this.currentResponse = '';

    this.abortController = new AbortController();

    try {
      const res = await fetch(OPENCLAW.URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENCLAW.TOKEN}`,
          'x-openclaw-agent-id': OPENCLAW.AGENT,
        },
        body: JSON.stringify({
          model: `openclaw:${OPENCLAW.AGENT}`,
          messages: this.messages,
          stream: true,
          user: OPENCLAW.USER,
        }),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      this.showTyping(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              this.currentResponse += delta;
              if (this.currentMsgEl) {
                this.currentMsgEl.querySelector('.msg-text').innerHTML = this.formatText(this.currentResponse);
                this.scrollToBottom();
              }
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      // Done streaming
      if (this.currentResponse) {
        this.messages.push({ role: 'assistant', content: this.currentResponse });
        this.saveSession();
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled
        if (this.currentResponse) {
          this.messages.push({ role: 'assistant', content: this.currentResponse });
          this.saveSession();
        }
      } else {
        this.showTyping(false);
        if (this.currentMsgEl) {
          this.currentMsgEl.querySelector('.msg-text').innerHTML =
            `<span style="color:#ef4444;">Error: ${err.message}</span>`;
        }
        this.el.status.textContent = 'error';
      }
    } finally {
      this.currentResponse = '';
      this.currentMsgEl = null;
      this.isStreaming = false;
      this.abortController = null;
      this.el.sendBtn.disabled = false;
      this.showTyping(false);
      if (this.el.status.textContent !== 'error') {
        this.el.status.textContent = 'present';
      }
    }
  },

  renderMessage(msg) {
    const el = this.createMessageEl(msg.role, msg.content);
    this.el.messages.appendChild(el);
    this.scrollToBottom();
  },

  createMessageEl(role, content) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div class="msg-name">${role === 'assistant' ? 'Alex 🐺' : 'Fox'}</div>
      <div class="msg-text">${content ? this.formatText(content) : ''}</div>
    `;
    return div;
  },

  addSystemNote(text) {
    const div = document.createElement('div');
    div.style.cssText = 'text-align:center;padding:20px;color:rgba(255,255,255,0.4);font-size:13px;font-style:italic;';
    div.textContent = text;
    this.el.messages.appendChild(div);
  },

  formatText(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(45,212,191,0.15);padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>')
      .replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  },

  showTyping(show) {
    this.el.typing.classList.toggle('visible', show);
    if (show) this.scrollToBottom();
  },

  scrollToBottom() {
    requestAnimationFrame(() => { this.el.messages.scrollTop = this.el.messages.scrollHeight; });
  },

  saveSession() {
    try { localStorage.setItem('nesteq_chat', JSON.stringify(this.messages.slice(-50))); } catch {}
  },

  loadSession() {
    try {
      const saved = localStorage.getItem('nesteq_chat');
      if (saved) {
        this.messages = JSON.parse(saved);
        for (const msg of this.messages) this.renderMessage(msg);
      }
    } catch {}
  },
};

document.addEventListener('DOMContentLoaded', () => ChatApp.init());
