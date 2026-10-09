const UPDATED = '9 October 2026';

const renderLegalPage = (title, botName, body) => `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${title} | ${botName}</title>
	<style>
		:root { color-scheme: light dark; --bg: #ffffff; --fg: #1f2328; --muted: #59636e; --link: #5865f2; }
		@media (prefers-color-scheme: dark) { :root { --bg: #1e1f22; --fg: #dbdee1; --muted: #949ba4; --link: #8b95f9; } }
		body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
		main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
		h1 { margin-bottom: 4px; }
		h2 { margin-top: 32px; font-size: 1.2rem; }
		.updated { color: var(--muted); margin-top: 0; }
		a { color: var(--link); }
		li { margin-bottom: 4px; }
	</style>
</head>
<body>
<main>
	<h1>${title}</h1>
	<p class="updated">${botName} &middot; Last updated ${UPDATED}</p>
	${body}
	<p><a href="/terms">Terms of Service</a> &middot; <a href="/privacy">Privacy Policy</a></p>
</main>
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
