const UPDATED = '9 October 2026';

const renderLegalPage = (title, botName, body) => `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${title} | ${botName}</title>
	<link rel="icon" type="image/svg+xml" href="/ezz/logo.svg">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
	<style>
		:root { color-scheme: dark; --bg: #090a0e; --card: #13151c; --border: rgba(255,255,255,.07); --fg: #e6e8ef; --muted: #969cac; --accent: #a08bff; }
		* { box-sizing: border-box; }
		body { margin: 0; min-height: 100vh; color: var(--fg); font: 16px/1.7 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
			background: radial-gradient(900px 480px at 12% -8%, rgba(124,92,255,.16), transparent 60%), radial-gradient(700px 420px at 100% 0%, rgba(34,211,238,.08), transparent 60%), var(--bg); background-attachment: fixed; }
		.wrap { max-width: 820px; margin: 0 auto; padding: 32px 18px 72px; }
		.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--fg); text-decoration: none; font-weight: 800; letter-spacing: -.02em; margin-bottom: 28px; }
		.brand img { width: 30px; height: 30px; border-radius: 9px; box-shadow: 0 6px 16px -6px rgba(124,92,255,.8); }
		.brand b { background: linear-gradient(90deg,#b9a8ff,#7c5cff 50%,#22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
		main { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 36px clamp(20px, 5vw, 48px); box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 24px 60px -30px rgba(0,0,0,.8); }
		h1 { margin: 0 0 4px; font-size: clamp(1.8rem, 4vw, 2.4rem); letter-spacing: -.03em; line-height: 1.2; }
		h2 { margin: 36px 0 8px; font-size: 1.15rem; letter-spacing: -.01em; }
		.updated { display: inline-block; color: var(--muted); margin: 6px 0 8px; font-size: .9rem; padding: 4px 12px; border: 1px solid var(--border); border-radius: 999px; }
		p, li { color: #c9cdd8; }
		a { color: var(--accent); text-underline-offset: 3px; }
		li { margin-bottom: 6px; }
		.links { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; gap: 18px; flex-wrap: wrap; font-size: .95rem; }
	</style>
</head>
<body>
<div class="wrap">
	<a class="brand" href="/"><img src="/ezz/logo.svg" alt=""><span>${botName.replace(/tickets$/i, '').trim() || botName} <b>Tickets</b></span></a>
	<main>
		<h1>${title}</h1>
		<p class="updated">${botName} &middot; Last updated ${UPDATED}</p>
		${body}
		<p class="links"><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></p>
	</main>
</div>
</body>
</html>`;

const escapeHtml = value => String(value ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;');

module.exports.legalRoute = (title, getBody) => () => ({
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		const botName = escapeHtml(client.user?.username ?? 'Ticket Bot');
		res
			.type('text/html; charset=utf-8')
			.send(renderLegalPage(title, botName, getBody(botName)));
	},
});
