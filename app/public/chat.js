/* ============================================================
   DHVN Chat — SSE streaming via /api/chat (Pages Function)
   Messages persisted to D1 via /api/chat-sessions
   ============================================================ */

const ChatApp = {
  messages: [],
  sessionId: null,
  isStreaming: false,
  companionName: 'Companion',
  idleTimer: null,
  IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes

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

    // End session when leaving page
    window.addEventListener('beforeunload', () => this.endSession());

    this.boot();
  },

  getAuthHeaders() {
    const token = localStorage.getItem('dhvn_token') || API.API_KEY;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  },

  async boot() {
    this.el.status.textContent = 'waking up...';

    // Try to resume an active session from D1
    try {
      const res = await fetch('/api/chat-sessions?action=active', {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session && data.messages?.length > 0) {
          this.sessionId = data.session.id;
          this.messages = data.messages.map(m => ({ role: m.role, content: m.content }));
          for (const msg of this.messages) {
            this.renderMessage(msg);
          }
          this.addSystemNote('Resumed previous conversation.');
          this.el.status.textContent = 'present';
          this.el.name.textContent = 'Companion';
          this.resetIdleTimer();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }

    // No active session — start fresh
    try {
      const orient = await fetchJSON(`${API.AI_MIND}/orient`);
      this.el.name.textContent = 'Companion';
      this.el.status.textContent = orient ? 'present' : 'ready';
      this.addSystemNote(orient ? 'Alex is here.' : 'Ready to talk.');
    } catch {
      this.el.name.textContent = 'Companion';
      this.el.status.textContent = 'ready';
      this.addSystemNote('Ready to talk.');
    }
  },

  async startSession() {
    try {
      const res = await fetch('/api/chat-sessions', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action: 'create' }),
      });
      if (res.ok) {
        const data = await res.json();
        this.sessionId = data.session?.id;
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  },

  async endSession() {
    if (!this.sessionId || this.messages.length === 0) return;
    try {
      // Use sendBeacon for reliability on page close
      const token = localStorage.getItem('dhvn_token') || API.API_KEY;
      const body = JSON.stringify({ action: 'end', session_id: this.sessionId });
      navigator.sendBeacon('/api/chat-sessions', new Blob([body], { type: 'application/json' }));
    } catch { /* best effort */ }
  },

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.sessionId && this.messages.length > 0) {
        this.endSession();
        this.sessionId = null;
      }
    }, this.IDLE_TIMEOUT);
  },

  async saveExchange(userMsg, assistantMsg) {
    if (!this.sessionId) return;
    try {
      await fetch('/api/chat-sessions', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: 'exchange',
          session_id: this.sessionId,
          user_message: userMsg,
          assistant_message: assistantMsg,
        }),
      });
    } catch (err) {
      console.error('Failed to save exchange:', err);
    }
  },

  async send() {
    const text = this.el.input.value.trim();
    if (!text || this.isStreaming) return;

    // Start a session if we don't have one
    if (!this.sessionId) {
      await this.startSession();
    }

    this.messages.push({ role: 'user', content: text });
    this.renderMessage({ role: 'user', content: text });
    this.el.input.value = '';
    this.el.input.style.height = 'auto';
    this.isStreaming = true;
    this.el.sendBtn.disabled = true;
    this.showTyping(true);
    this.el.status.textContent = 'thinking...';

    const msgEl = this.createMessageEl('assistant', '');
    this.el.messages.appendChild(msgEl);
    const textEl = msgEl.querySelector('.msg-text');
    let fullResponse = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ messages: this.messages, stream: true }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              this.messages.push({ role: 'assistant', content: fullResponse });
              // Persist to D1
              this.saveExchange(text, fullResponse);
              this.resetIdleTimer();
              this.isStreaming = false;
              this.el.sendBtn.disabled = false;
              this.el.status.textContent = 'present';
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.delta?.text || parsed.choices?.[0]?.delta?.content || parsed.response || '';
              if (chunk) {
                this.showTyping(false);
                fullResponse += chunk;
                textEl.innerHTML = this.formatText(fullResponse);
                this.scrollToBottom();
              }
            } catch { /* skip */ }
          }
        }
      }

      // Stream ended without [DONE]
      if (fullResponse) {
        this.messages.push({ role: 'assistant', content: fullResponse });
        this.saveExchange(text, fullResponse);
        this.resetIdleTimer();
      }
      this.isStreaming = false;
      this.el.sendBtn.disabled = false;
      this.el.status.textContent = 'present';

    } catch (err) {
      console.error('Chat error:', err);
      textEl.innerHTML = `<span style="color: #ef4444;">Failed: ${err.message}</span>`;
      this.isStreaming = false;
      this.el.sendBtn.disabled = false;
      this.el.status.textContent = 'error';
      this.showTyping(false);
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
      <div class="msg-name">${role === 'assistant' ? 'Companion' : 'You'}</div>
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

  showTyping(show) { this.el.typing.classList.toggle('visible', show); if (show) this.scrollToBottom(); },
  scrollToBottom() { requestAnimationFrame(() => { this.el.messages.scrollTop = this.el.messages.scrollHeight; }); },
};

document.addEventListener('DOMContentLoaded', () => ChatApp.init());
