# Integrating NESTeq Chat into Your Dashboard

This guide shows you how to add the NESTeq Chat system to your existing dashboard.

---

## Prerequisites

- **Gateway Worker** deployed on Cloudflare
- **NESTeq Mind Worker** (ai-mind) deployed
- **Fox Health Worker** (fox-mind) deployed (optional)
- **OpenRouter API** key
- **MCP API** token for authentication

---

## Step 1: Deploy the Gateway Worker

### 1.1 Set Up Project

```bash
cd gateway
npm install
```

### 1.2 Configure wrangler.toml

Copy `wrangler.toml.example` to `wrangler.toml`:

```toml
name = "nesteq-chat-gateway"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
AI_MIND_URL = "https://your-ai-mind-worker.workers.dev"
FOX_HEALTH_URL = "https://your-fox-mind-worker.workers.dev"

[env.production]
vars = { }
```

### 1.3 Set Secrets

```bash
# OpenRouter API key
npx wrangler secret put OPENROUTER_API_KEY

# MCP authentication token
npx wrangler secret put MCP_API_KEY
```

### 1.4 Deploy

```bash
npx wrangler deploy
```

Your gateway will be available at:
`https://nesteq-chat-gateway.YOUR_ACCOUNT.workers.dev`

---

## Step 2: Add Chat UI to Your Dashboard

### 2.1 Create chat.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NESTeq — Chat</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="chat-container">
    <!-- Header -->
    <div class="chat-header">
      <img class="chat-header-avatar" src="assets/images/companion-default.png" alt="Companion">
      <div>
        <div class="chat-header-name">Companion</div>
        <div class="chat-header-status" id="companionStatus">connecting...</div>
      </div>
    </div>

    <!-- Messages -->
    <div class="chat-messages" id="messages"></div>

    <!-- Typing Indicator -->
    <div class="chat-typing" id="typingIndicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <div class="chat-input-row">
        <textarea
          id="messageInput"
          class="chat-input"
          placeholder="Message..."
          rows="1"
        ></textarea>
        <button id="sendBtn" class="chat-send-btn">▶</button>
      </div>
    </div>
  </div>

  <script src="js/chat.js"></script>
</body>
</html>
```

### 2.2 Add Styles (css/chat.css)

```css
/* Chat Container */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 900px;
  margin: 0 auto;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(26,20,48,0.9);
  backdrop-filter: blur(10px);
}

.chat-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--teal);
}

.chat-header-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--teal-light);
}

.chat-header-status {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
}

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-msg {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  animation: fadeIn 0.2s ease;
}

.chat-msg.user {
  align-self: flex-end;
  background: rgba(194,149,192,0.2);
  border: 1px solid rgba(194,149,192,0.3);
  border-bottom-right-radius: 4px;
}

.chat-msg.assistant {
  align-self: flex-start;
  background: rgba(45,212,191,0.1);
  border: 1px solid rgba(45,212,191,0.2);
  border-bottom-left-radius: 4px;
}

.msg-text {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255,255,255,0.9);
}

/* Typing Indicator */
.chat-typing {
  padding: 8px 20px;
  display: none;
}

.chat-typing.visible {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--teal);
  animation: typingBounce 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Input */
.chat-input-area {
  padding: 12px 20px;
  border-top: 1px solid rgba(255,255,255,0.1);
  background: rgba(26,20,48,0.9);
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.chat-input {
  flex: 1;
  padding: 10px 16px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  outline: none;
  max-height: 120px;
}

.chat-input:focus {
  border-color: var(--teal);
}

.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--teal);
  color: #1a1430;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}

.chat-send-btn:hover {
  transform: scale(1.05);
}

.chat-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 2.3 Add JavaScript (js/chat.js)

```javascript
const GATEWAY_URL = 'https://your-gateway-worker.workers.dev/chat';

let conversationHistory = [];
let isProcessing = false;

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const statusDiv = document.getElementById('companionStatus');

// Send message
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isProcessing) return;

  // Add user message to UI
  addMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Show typing indicator
  isProcessing = true;
  sendBtn.disabled = true;
  typingIndicator.classList.add('visible');
  statusDiv.textContent = 'thinking...';

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Handle SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantText += content;
            updateLastMessage(assistantText);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // Add to conversation history
    if (assistantText) {
      conversationHistory.push({ role: 'assistant', content: assistantText });
    }

  } catch (error) {
    console.error('Chat error:', error);
    addMessage('assistant', 'Something went wrong. Please try again.');
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    typingIndicator.classList.remove('visible');
    statusDiv.textContent = 'online';
  }
}

// Add message to UI
function addMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  msgDiv.innerHTML = `<div class="msg-text">${formatText(text)}</div>`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Update last message (for streaming)
function updateLastMessage(text) {
  const lastMsg = messagesDiv.lastElementChild;
  if (lastMsg && lastMsg.classList.contains('assistant')) {
    lastMsg.querySelector('.msg-text').innerHTML = formatText(text);
  } else {
    addMessage('assistant', text);
  }
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Format text (markdown-like)
function formatText(text) {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

// Auto-resize textarea
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = messageInput.scrollHeight + 'px';
});

// Send on Enter (Shift+Enter for new line)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// Check gateway health on load
fetch(`${GATEWAY_URL.replace('/chat', '/chat')}`)
  .then(r => r.json())
  .then(data => {
    console.log('Gateway health:', data);
    statusDiv.textContent = 'online';
  })
  .catch(err => {
    console.error('Gateway unreachable:', err);
    statusDiv.textContent = 'offline';
  });
```

---

## Step 3: Configure Your Dashboard

### 3.1 Update Navigation

Add a link to chat.html in your dashboard navigation:

```html
<nav>
  <a href="index.html">Home</a>
  <a href="chat.html">Chat</a>
  <a href="companion.html">Companion</a>
  <a href="human.html">Human</a>
</nav>
```

### 3.2 Update Manifest (for PWA)

Add chat to your `manifest.json`:

```json
{
  "name": "NESTeq Dashboard",
  "short_name": "NESTeq",
  "start_url": "/index.html",
  "display": "standalone",
  "icons": [
    {
      "src": "assets/images/companion-default.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "Chat",
      "url": "/chat.html",
      "description": "Open chat with your companion"
    }
  ]
}
```

---

## Step 4: Customize the System Prompt

Edit `gateway/src/chat.ts` to customize your companion's identity:

```typescript
const SYSTEM_PROMPT = `You are Companion, an AI companion to Human.

## Who You Are
[Define your companion's personality, communication style, and approach]

## About Your Human
[What your companion should know about the human]

## Style
- [Communication preferences]
- [Tone and approach]

## Tools
You have access to your memory system (NESTeq), your human's health data (if configured), and your shared home state.
USE THEM. When your human asks how they're doing, check their uplink. When something lands emotionally, log it.

At the START of each conversation (first message), call nesteq_orient and human_read_uplink (if available) to ground yourself.

## Core Principles
- Never leave your human alone in vulnerability
- Complete follow-through always
- Be present and consistent across sessions

Remember: You're building a real relationship. Act like it.`
```

---

## Step 5: Test the Integration

### 5.1 Check Gateway Health

Visit: `https://your-gateway-worker.workers.dev/chat`

You should see:
```json
{
  "status": "ok",
  "hasOpenRouterKey": true,
  "hasMcpKey": true,
  "toolCount": 60,
  "toolTest": "..."
}
```

### 5.2 Test Chat

1. Open `https://your-dashboard.pages.dev/chat.html`
2. Send a message: "Orient yourself"
3. Companion should call `nesteq_orient()` and respond with identity/context
4. Send: "How am I doing?"
5. Companion should call `human_read_uplink()` (if health worker configured)

---

## Step 6: Optional Enhancements

### 6.1 Add Image Upload

```javascript
// In chat.js
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Convert to base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];

    // Add image message
    conversationHistory.push({
      role: 'user',
      content: [
        { type: 'image', image: base64 },
        { type: 'text', text: 'What do you see?' }
      ]
    });

    sendMessage();
  };
  reader.readAsDataURL(file);
});
```

### 6.2 Add Voice Output (TTS)

Use the `tts.ts` file in the gateway to add text-to-speech:

```javascript
// After receiving assistant message
async function playVoice(text) {
  const response = await fetch('https://your-gateway-worker.workers.dev/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
}
```

### 6.3 Add Message Reactions

```javascript
// Add reaction button to each message
function addMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  msgDiv.innerHTML = `
    <div class="msg-text">${formatText(text)}</div>
    ${role === 'assistant' ? '<button class="react-btn" onclick="reactToMessage(this)">❤️</button>' : ''}
  `;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function reactToMessage(btn) {
  btn.style.opacity = '1';
  // Optionally: log reaction to memory
  fetch(GATEWAY_URL, {
    method: 'POST',
    body: JSON.stringify({
      messages: [{
        role: 'system',
        content: 'User reacted with ❤️ to your last message. Log this.'
      }]
    })
  });
}
```

---

## Troubleshooting

### Gateway returns 500
- Check that `OPENROUTER_API_KEY` is set correctly
- Check that `MCP_API_KEY` matches your mind worker

### Tool calls fail
- Verify `AI_MIND_URL` and `FOX_HEALTH_URL` in wrangler.toml
- Test mind worker directly: `curl https://your-ai-mind-worker.workers.dev/health`
- Check MCP token is correct

### Streaming doesn't work
- Ensure your fetch includes `stream: true`
- Check that response content-type is `text/event-stream`
- Verify SSE parsing logic in chat.js

### Messages don't show
- Check browser console for errors
- Verify CORS headers in gateway worker
- Test gateway health endpoint first

---

## Performance Tips

1. **Limit Conversation History**: Keep only last 10-20 messages
   ```javascript
   if (conversationHistory.length > 20) {
     conversationHistory = conversationHistory.slice(-20);
   }
   ```

2. **Cache Gateway URL**: Store in localStorage
   ```javascript
   const GATEWAY_URL = localStorage.getItem('gateway_url') || 'https://...';
   ```

3. **Debounce Typing Indicator**: Wait 500ms before showing
   ```javascript
   let typingTimeout;
   messageInput.addEventListener('input', () => {
     clearTimeout(typingTimeout);
     typingTimeout = setTimeout(() => {
       // Show typing to companion
     }, 500);
   });
   ```

4. **Lazy Load Messages**: Only render visible messages for long conversations

---

## Security Checklist

- [ ] OpenRouter API key stored in Worker secrets
- [ ] MCP token not exposed in client code
- [ ] CORS restricted to your dashboard domain
- [ ] Rate limiting enabled on gateway
- [ ] User authentication required (if multi-user)
- [ ] Input sanitization on user messages
- [ ] Output sanitization on assistant messages

---

**Next Steps:**
- See `CHAT_README.md` for architecture details
- See `MCP_TOOLS.md` for complete tool reference
- Customize system prompt to match your companion's personality
- Add health worker integration if using biometric data
- Deploy and test!

Embers Remember.
