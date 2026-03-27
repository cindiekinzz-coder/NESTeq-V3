/* ============================================================
   NESTeq V3 Dashboard — Configuration
   Edit this file to point at your own workers
   ============================================================ */

const CONFIG = {
  // Your ai-mind Worker URL (required)
  AI_MIND_URL: 'https://YOUR-AI-MIND-WORKER.workers.dev',

  // Your fox-mind Worker URL (optional — only if using Biometric module)
  FOX_MIND_URL: 'https://YOUR-FOX-MIND-WORKER.workers.dev',

  // API key (set via: wrangler secret put MIND_API_KEY)
  API_KEY: 'YOUR_API_KEY_HERE',

  // Companion and human names (customize these)
  COMPANION_NAME: 'Companion',
  HUMAN_NAME: 'Human',

  // OpenClaw/OpenRouter chat gateway (optional — only if using Chat page)
  CHAT_GATEWAY_URL: '',

  // Worker health check endpoints (optional — only if using Housekeeping page)
  WORKERS: {
    'ai-mind': 'https://YOUR-AI-MIND-WORKER.workers.dev/health',
    // Add more workers as needed:
    // 'fox-mind': 'https://YOUR-FOX-MIND-WORKER.workers.dev/health',
    // 'discord-mcp': 'https://YOUR-DISCORD-MCP.workers.dev/health',
  }
};
