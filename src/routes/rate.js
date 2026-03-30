const { decrypt, encrypt } = require('../lib/crypto');

const escapeHtml = value => String(value ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const renderForm = data => {
	const ticketLine = `${escapeHtml(data.category || 'Ticket')} #${escapeHtml(data.number || data.ticketId)}`;

	const statusBadge = data.state === 'done'
		? '<span class="state-pill pill-green">Already rated</span>'
		: data.state === 'blocked'
			? '<span class="state-pill pill-amber">Not eligible</span>'
			: '';

	const form = data.state === 'open' ? `<form method="post" action="/rate" class="rating-form">
	<input type="hidden" name="ticket" value="${escapeHtml(data.ticketId)}">
	<div class="field">
		<label class="field-label" for="rating">Rating (0–5)</label>
		<input class="field-input" id="rating" name="rating" type="number" min="0" max="5" step="1" required placeholder="0–5">
	</div>
	<div class="field">
		<label class="field-label" for="comment">Comment <span class="field-opt">(optional)</span></label>
		<textarea class="field-input" id="comment" name="comment" rows="4" placeholder="Tell us what went well or could be better."></textarea>
	</div>
	<button type="submit" class="submit-btn">Submit rating</button>
</form>` : '';

	const doneInfo = data.state === 'done' ? `<div class="done-card">
	<div class="score-badge">
		<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 15 8l7 .6-5 4.9 1.6 7-6.6-3.7L5.4 20 7 13.5 2 8.6 9 8l3-6z"/></svg>
		${escapeHtml(String(data.rating))} / 5
	</div>
	<div class="done-ticket">${ticketLine}</div>
	${data.comment ? `<p class="done-comment">${escapeHtml(data.comment)}</p>` : ''}
</div>` : '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Rate ticket</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
	<style>
		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

		:root {
			--bg:         #0a0a0a;
			--surface:    #111111;
			--border:     #1f1f1f;
			--border2:    #2a2a2a;
			--text:       #f0f0f0;
			--muted:      #666;
			--accent:     #ffffff;
			--accent-dim: rgba(255,255,255,0.08);
			--tile:       22px;
		}

		html, body { height: 100%; }

		body {
			background-color: var(--bg);
			color: var(--text);
			font-family: 'IBM Plex Mono', monospace;
			overflow-x: hidden;
			min-height: 100vh;
			position: relative;
		}

		/* Square tile grid background */
		body::before {
			content: '';
			position: fixed;
			inset: 0;
			z-index: 0;
			background-image:
				linear-gradient(rgba(255,255,255,0.032) 1px, transparent 1px),
				linear-gradient(90deg, rgba(255,255,255,0.032) 1px, transparent 1px);
			background-size: var(--tile) var(--tile);
			pointer-events: none;
		}

		main {
			position: relative;
			z-index: 1;
			max-width: 560px;
			margin: 0 auto;
			padding: 60px 28px 80px;
		}

		/* ── Header ── */
		.page-title {
			font-family: 'Syne', sans-serif;
			font-size: 26px;
			font-weight: 800;
			color: var(--accent);
			letter-spacing: -0.5px;
			margin-bottom: 4px;
		}

		.page-sub {
			font-size: 10px;
			color: var(--muted);
			letter-spacing: 0.12em;
			text-transform: uppercase;
			margin-bottom: 28px;
		}

		/* ── State pills ── */
		.state-pill {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 5px 12px;
			border-radius: 5px;
			font-size: 11px;
			font-weight: 700;
			letter-spacing: 0.04em;
			margin-bottom: 20px;
		}

		.pill-green {
			background: rgba(35,165,89,0.12);
			border: 1px solid rgba(35,165,89,0.35);
			color: #4ade80;
		}

		.pill-amber {
			background: rgba(240,178,50,0.1);
			border: 1px solid rgba(240,178,50,0.3);
			color: #fbbf24;
		}

		/* ── Form card ── */
		.rating-form {
			display: flex;
			flex-direction: column;
			gap: 16px;
			background: var(--surface);
			border: 1px solid var(--border2);
			border-radius: 10px;
			padding: 20px;
		}

		.field {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.field-label {
			font-size: 11px;
			letter-spacing: 0.1em;
			text-transform: uppercase;
			color: var(--muted);
		}

		.field-opt {
			color: #444;
			letter-spacing: 0;
			text-transform: none;
			font-size: 10px;
		}

		.field-input {
			background: var(--bg);
			border: 1px solid var(--border2);
			border-radius: 6px;
			color: var(--text);
			font-family: 'IBM Plex Mono', monospace;
			font-size: 13px;
			padding: 10px 12px;
			outline: none;
			resize: vertical;
			transition: border-color 0.15s;
		}

		.field-input::placeholder { color: #333; }
		.field-input:focus { border-color: #444; }

		.submit-btn {
			background: var(--accent);
			color: #000;
			border: none;
			border-radius: 6px;
			font-family: 'IBM Plex Mono', monospace;
			font-size: 13px;
			font-weight: 400;
			padding: 11px 16px;
			cursor: pointer;
			letter-spacing: 0.02em;
			align-self: flex-start;
			transition: opacity 0.15s;
		}

		.submit-btn:hover { opacity: 0.85; }

		/* ── Done card ── */
		.done-card {
			background: var(--surface);
			border: 1px solid var(--border2);
			border-radius: 10px;
			padding: 18px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		}

		.score-badge {
			display: inline-flex;
			align-items: center;
			gap: 5px;
			padding: 4px 10px;
			border: 1px solid var(--border2);
			border-radius: 5px;
			font-size: 12px;
			font-weight: 700;
			color: var(--accent);
			background: var(--accent-dim);
			width: fit-content;
		}

		.done-ticket {
			font-size: 12px;
			color: var(--muted);
		}

		.done-comment {
			font-size: 13px;
			color: #b0b0b0;
			line-height: 1.55;
		}

		/* ── Back link ── */
		.back-link {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			color: var(--muted);
			text-decoration: none;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			margin-bottom: 24px;
			transition: color 0.15s;
		}

		.back-link:hover { color: var(--accent); }
	</style>
</head>
<body>
<main>
	<a class="back-link" href="/rating">
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
		All ratings
	</a>

	<div class="page-title">Rate ticket</div>
	<div class="page-sub">${ticketLine}</div>

	${statusBadge}
	${doneInfo}
	${form}
</main>
</body>
</html>`;
};

module.exports.get = () => ({
	path: '/rate',
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		let user;
		try {
			user = await req.jwtVerify();
		} catch {
			const redirect = encodeURIComponent(req.url);
			return res.redirect(`/auth/login?r=${redirect}`);
		}

		const ticketId = String(req.query.ticket || '').trim();
		if (!ticketId) return res.code(400).send('Missing ticket');

		const ticket = await client.prisma.ticket.findUnique({
			include: { category: true, feedback: true },
			where: { id: ticketId },
		});
		if (!ticket) return res.code(404).send('Ticket not found');

		const state = (() => {
			if (ticket.createdById !== user.id) return 'blocked';
			if (!ticket.closedAt) return 'blocked';
			if (ticket.feedback) return 'done';
			return 'open';
		})();

		let viewerRoleName = null;
		let viewerRoleColor = null;
		let viewerDisplay = user.username || user.displayName || 'You';
		let viewerId = user.id;
		const guild = client.guilds.cache.get(ticket.guildId);
		if (guild) {
			const member = await guild.members.fetch(user.id).catch(() => null);
			if (member) {
				viewerRoleName = member.roles.highest?.name || null;
				viewerRoleColor = member.roles.highest?.hexColor || null;
				viewerDisplay = member.displayName || viewerDisplay;
			}
		}

		const viewModel = {
			category: ticket.category?.name,
			comment: ticket.feedback?.comment ? decrypt(ticket.feedback.comment) : null,
			number: ticket.number,
			rating: ticket.feedback?.rating,
			state,
			ticketId,
			viewerName: viewerDisplay,
			viewerId,
			viewerRoleName,
			viewerRoleColor,
		};

		const html = renderForm(viewModel);
		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(html);
	},
});

module.exports.post = () => ({
	path: '/rate',
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		let user;
		try {
			user = await req.jwtVerify();
		} catch {
			const redirect = encodeURIComponent(req.url);
			return res.redirect(`/auth/login?r=${redirect}`);
		}

		const ticketId = String(req.body.ticket || '').trim();
		if (!ticketId) return res.code(400).send('Missing ticket');

		const ticket = await client.prisma.ticket.findUnique({
			include: { feedback: true },
			where: { id: ticketId },
		});
		if (!ticket) return res.code(404).send('Ticket not found');
		if (ticket.createdById !== user.id) return res.code(403).send('You can only rate your own ticket.');
		if (!ticket.closedAt) return res.code(400).send('Ticket is not closed yet.');
		if (ticket.feedback) return res.code(400).send('Rating already submitted.');

		let rating = Number.parseInt(req.body.rating, 10);
		if (!Number.isFinite(rating)) rating = 0;
		rating = Math.min(Math.max(rating, 0), 5);
		const rawComment = String(req.body.comment || '').trim();
		const encryptedComment = rawComment ? await encrypt(rawComment) : null;

		await client.prisma.feedback.create({
			data: {
				comment: encryptedComment,
				guild: { connect: { id: ticket.guildId } },
				rating,
				ticket: { connect: { id: ticketId } },
				user: {
					connectOrCreate: {
						create: { id: user.id },
						where: { id: user.id },
					},
				},
			},
		});

		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Rating submitted</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Syne:wght@800&display=swap" rel="stylesheet">
	<style>
		*{box-sizing:border-box;margin:0;padding:0;}
		:root{--bg:#0a0a0a;--surface:#111;--border2:#2a2a2a;--text:#f0f0f0;--muted:#666;--accent:#fff;--tile:22px;}
		body{background:var(--bg);color:var(--text);font-family:'IBM Plex Mono',monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;}
		body::before{content:'';position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,0.032) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.032) 1px,transparent 1px);background-size:var(--tile) var(--tile);pointer-events:none;}
		.card{position:relative;z-index:1;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:28px 32px;display:flex;flex-direction:column;gap:14px;max-width:360px;width:100%;}
		.ttl{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--accent);}
		.sub{font-size:12px;color:var(--muted);}
		a{color:var(--accent);text-decoration:none;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #2a2a2a;padding-bottom:1px;}
		a:hover{border-color:#555;}
	</style>
</head>
<body>
	<div class="card">
		<div class="ttl">Rating submitted</div>
		<p class="sub">Thanks for your feedback — it helps us improve support quality.</p>
		<a href="/rating">View all ratings</a>
	</div>
</body>
</html>`);
	},
});
