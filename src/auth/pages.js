/** Plain HTML auth pages — no React, no hash router. */

export function loginPageHtml({ error } = {}) {
  const msg =
    error === 'forbidden'
      ? `<p class="err">That GitHub account is not on the allowlist.</p>`
      : error
        ? `<p class="err">Sign-in failed. Try again.</p>`
        : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in — Fresh Prints</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
  <style>
    :root { --ink:#111; --paper:#f7f4ec; --rule:#222; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: var(--paper);
      background-image: radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px);
      background-size: 4px 4px;
      color: var(--ink);
      font-family: "Source Serif 4", Georgia, serif;
    }
    main {
      width: min(420px, 92vw);
      border: 1px solid var(--rule);
      padding: 2.5rem 2rem;
      text-align: center;
    }
    h1 {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 2.4rem; margin: 0 0 0.25rem; letter-spacing: 0.02em;
    }
    .sub { font-size: 0.85rem; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.75rem; }
    a.btn {
      display: inline-block; padding: 0.7rem 1.4rem;
      border: 1px solid var(--ink); color: var(--ink); text-decoration: none;
      font-size: 1rem;
    }
    a.btn:hover { background: var(--ink); color: var(--paper); }
    .err { color: #5c1a1a; font-size: 0.95rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>Fresh Prints</h1>
    <div class="sub">Private morning edition</div>
    ${msg}
    <a class="btn" href="/auth/github">Sign in with GitHub</a>
  </main>
</body>
</html>`;
}

export function forbiddenPageHtml({ username } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>403 — Fresh Prints</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Serif+4:opsz,wght@8..60,400&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #f7f4ec; color: #111;
      font-family: "Source Serif 4", Georgia, serif;
    }
    main { width: min(480px, 92vw); border: 1px solid #222; padding: 2.5rem 2rem; text-align: center; }
    h1 { font-family: "Playfair Display", Georgia, serif; font-size: 2rem; margin: 0 0 1rem; }
    p { line-height: 1.5; }
    a { color: #111; }
  </style>
</head>
<body>
  <main>
    <h1>403 — Not on the list</h1>
    <p>GitHub user <strong>${escapeHtml(username || 'unknown')}</strong> is not allowlisted for this private edition.</p>
    <p><a href="/auth/logout">Sign out</a> · <a href="/auth/login">Try another account</a></p>
  </main>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
