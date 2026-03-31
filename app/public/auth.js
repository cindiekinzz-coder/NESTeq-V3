/* ============================================================
   DHVN — Auth Layer
   PIN overlay on page load. Include on every page BEFORE other JS.
   ============================================================ */

(function() {
  const storedHash = localStorage.getItem('dhvn_pin');
  if (!storedHash) return; // No PIN set, skip

  // Check if already authenticated this session
  const sessionAuth = sessionStorage.getItem('dhvn_authed');
  if (sessionAuth === 'true') return;

  // Block the page
  const overlay = document.createElement('div');
  overlay.id = 'dhvn-pin-overlay';
  overlay.innerHTML = `
    <div style="
      position: fixed; inset: 0; z-index: 99999;
      background: #1a1430;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
    ">
      <div style="text-align: center; max-width: 300px;">
        <div style="font-size: 28px; font-weight: 700; color: #5ce1e6; margin-bottom: 8px; letter-spacing: 3px;">DHVN</div>
        <div style="font-size: 13px; color: #828ec2; margin-bottom: 32px;">NESTeq Project</div>
        <input type="password" id="dhvn-pin-input"
          maxlength="8" inputmode="numeric" autofocus
          placeholder="PIN"
          style="
            width: 100%; padding: 14px 20px; text-align: center;
            font-size: 24px; letter-spacing: 8px; font-family: inherit;
            border-radius: 12px; border: 1px solid rgba(130,142,194,0.3);
            background: rgba(67,82,137,0.4); color: #ffffff; outline: none;
          ">
        <div id="dhvn-pin-error" style="
          margin-top: 12px; font-size: 13px; color: #ef4444;
          min-height: 20px; opacity: 0; transition: opacity 0.2s;
        "></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Hide page content until authed
  document.body.style.overflow = 'hidden';

  const input = document.getElementById('dhvn-pin-input');
  const errorEl = document.getElementById('dhvn-pin-error');

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const pin = input.value;
      if (!pin) return;

      const hash = await hashPin(pin);
      if (hash === storedHash) {
        sessionStorage.setItem('dhvn_authed', 'true');
        overlay.remove();
        document.body.style.overflow = '';
      } else {
        errorEl.textContent = 'Wrong PIN';
        errorEl.style.opacity = '1';
        input.value = '';
        setTimeout(() => { errorEl.style.opacity = '0'; }, 2000);
      }
    }
  });

  async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'dhvn-salt');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
})();
