const { decrypt } = require('../lib/crypto');

const escapeHtml = value => String(value ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const fmtRating = value => {
	const v = Number(value) || 0;
	const fixed = v.toFixed(1);
	return fixed.endsWith('.0') ? String(Math.round(v)) : fixed;
};

const renderPage = (stats, entries, query) => {
	const avg = stats.count ? (stats.sum / stats.count) : 0;
	const avgText = fmtRating(avg);
	const cards = entries.map(e => `<article class="card">
	<header class="card-header">
		<div class="card-meta">
			<div class="card-title">${escapeHtml(e.ticketLabel)}</div>
			<div class="card-guild">${escapeHtml(e.guildName)}</div>
		</div>
		<div class="score-badge">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 15 8l7 .6-5 4.9 1.6 7-6.6-3.7L5.4 20 7 13.5 2 8.6 9 8l3-6z"/></svg>
			${fmtRating(e.rating)}/5
		</div>
	</header>
	<div class="card-rater">By <span class="rater-name" style="color:${escapeHtml(e.raterRoleColor || '#ffffff')}">${escapeHtml(e.raterDisplay || 'Unknown')}</span>${e.raterRole ? ` <span class="role-pill" style="background:${escapeHtml(e.raterRoleColor || '#333')}22;border-color:${escapeHtml(e.raterRoleColor || '#555')}55;color:${escapeHtml(e.raterRoleColor || '#aaa')}">${escapeHtml(e.raterRole)}</span>` : ''}${e.raterId ? ` <span class="id-chip">ID: ${escapeHtml(e.raterId)}</span>` : ''}</div>
	<div class="card-body">${e.comment ? escapeHtml(e.comment) : '<span class="no-comment">no comment</span>'}</div>
	<footer class="card-footer">
		<span class="card-time">${escapeHtml(e.when)}</span>
		${e.canDelete ? `<form method="post" action="/rating/delete" class="delete-form"><input type="hidden" name="ticket" value="${escapeHtml(e.ticketId)}"><button type="submit" class="btn-delete">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</button></form>` : ''}
	</footer>
</article>`).join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Ticket Ratings</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
	<style>
		*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

		:root {
			--bg:       #0a0a0a;
			--surface:  #111111;
			--border:   #1f1f1f;
			--border2:  #2a2a2a;
			--text:     #f0f0f0;
			--muted:    #666;
			--accent:   #ffffff;
			--accent-dim: rgba(255,255,255,0.08);
			--tile:     22px;
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
			max-width: 1240px;
			margin: 0 auto;
			padding: 40px 28px 80px;
		}

		/* ── Top bar ── */
		.topbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 20px;
			margin-bottom: 40px;
			flex-wrap: wrap;
		}

		.brand {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.brand-name {
			font-family: 'Syne', sans-serif;
			font-size: 26px;
			font-weight: 800;
			color: var(--accent);
			letter-spacing: -0.5px;
		}

		.brand-sub {
			font-size: 11px;
			color: var(--muted);
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		/* ── Search ── */
		.search-wrap {
			display: flex;
			gap: 0;
			border: 1px solid var(--border2);
			border-radius: 8px;
			overflow: hidden;
			background: var(--surface);
		}

		.search-wrap input {
			background: transparent;
			border: none;
			outline: none;
			color: var(--text);
			font-family: 'IBM Plex Mono', monospace;
			font-size: 13px;
			padding: 10px 14px;
			min-width: 280px;
		}

		.search-wrap input::placeholder { color: var(--muted); }

		.search-wrap button {
			background: var(--accent);
			color: #000;
			border: none;
			font-family: 'IBM Plex Mono', monospace;
			font-size: 13px;
			font-weight: 400;
			padding: 10px 18px;
			cursor: pointer;
			letter-spacing: 0.02em;
			transition: opacity 0.15s;
		}

		.search-wrap button:hover { opacity: 0.85; }

		/* ── Stat pills ── */
		.stat-row {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			margin-bottom: 32px;
		}

		.stat-pill {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 7px 14px;
			border: 1px solid var(--border2);
			border-radius: 6px;
			background: var(--surface);
			font-size: 12px;
			color: var(--muted);
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}

		.stat-pill strong {
			color: var(--accent);
			font-size: 14px;
			font-weight: 700;
			letter-spacing: 0;
			text-transform: none;
		}

		.stat-pill .dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--accent);
			flex-shrink: 0;
		}

		/* ── Cards grid ── */
		.cards {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
			gap: 12px;
			align-items: start;
		}

		.card {
			background: var(--surface);
			border: 1px solid var(--border2);
			border-radius: 10px;
			padding: 16px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			transition: border-color 0.18s, transform 0.18s;
			position: relative;
			overflow: hidden;
		}

		/* Subtle top-left corner highlight */
		.card::before {
			content: '';
			position: absolute;
			top: 0; left: 0;
			width: 60px; height: 60px;
			background: radial-gradient(circle at 0 0, rgba(255,255,255,0.04), transparent 70%);
			pointer-events: none;
		}

		.card:hover {
			border-color: #3a3a3a;
			transform: translateY(-2px);
		}

		/* Card header */
		.card-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 10px;
		}

		.card-title {
			font-family: 'Syne', sans-serif;
			font-size: 15px;
			font-weight: 700;
			color: var(--accent);
		}

		.card-guild {
			font-size: 11px;
			color: var(--muted);
			margin-top: 2px;
			letter-spacing: 0.04em;
		}

		.score-badge {
			display: inline-flex;
			align-items: center;
			gap: 5px;
			padding: 4px 9px;
			border: 1px solid var(--border2);
			border-radius: 5px;
			font-size: 12px;
			font-weight: 700;
			color: var(--accent);
			background: var(--accent-dim);
			white-space: nowrap;
			flex-shrink: 0;
		}

		/* Rater line */
		.card-rater {
			font-size: 11px;
			color: var(--muted);
		}

		.rater-name {
			font-weight: 700;
		}

		.role-pill {
			display: inline-block;
			font-size: 10px;
			padding: 1px 6px;
			border-radius: 4px;
			border: 1px solid;
			margin-left: 4px;
			vertical-align: middle;
		}

		.id-chip {
			font-size: 10px;
			color: var(--muted);
			margin-left: 4px;
		}

		/* Card body */
		.card-body {
			font-size: 13px;
			color: #b0b0b0;
			line-height: 1.55;
			flex: 1;
		}

		.no-comment {
			color: var(--muted);
			font-style: italic;
		}

		/* Card footer */
		.card-footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 8px;
			border-top: 1px solid var(--border);
			padding-top: 10px;
		}

		.card-time {
			font-size: 11px;
			color: var(--muted);
		}

		.delete-form { margin: 0; }

		.btn-delete {
			display: inline-flex;
			align-items: center;
			gap: 5px;
			background: transparent;
			border: 1px solid #3a1a1a;
			color: #cc4444;
			padding: 4px 10px;
			border-radius: 5px;
			font-family: 'IBM Plex Mono', monospace;
			font-size: 11px;
			font-weight: 700;
			cursor: pointer;
			transition: background 0.15s, border-color 0.15s;
		}

		.btn-delete:hover {
			background: rgba(204,68,68,0.12);
			border-color: #cc4444;
		}

		/* Empty state */
		.empty {
			grid-column: 1/-1;
			padding: 60px 20px;
			text-align: center;
			color: var(--muted);
			font-size: 13px;
			border: 1px dashed var(--border2);
			border-radius: 10px;
		}

		/* Divider */
		.section-label {
			font-size: 10px;
			letter-spacing: 0.14em;
			text-transform: uppercase;
			color: var(--muted);
			margin-bottom: 14px;
		}

		@media (max-width: 600px) {
			.topbar { flex-direction: column; align-items: flex-start; }
			.search-wrap input { min-width: 0; width: 100%; }
			.search-wrap { width: 100%; }
		}
	</style>
</head>
<body>
<main>
	<!-- Top bar -->
	<div class="topbar">
		<div class="brand">
			<div class="brand-name">Ticket Ratings</div>
			<div class="brand-sub">Support feedback overview</div>
		</div>
		<form class="search-wrap" method="get" action="/rating">
			<input type="text" name="q" value="${escapeHtml(query || '')}" placeholder="Search ticket ID, user ID or username…">
			<button type="submit">Search</button>
		</form>
	</div>

	<!-- Stat pills -->
	<div class="stat-row">
		<div class="stat-pill">
			<span class="dot"></span>
			<span>Average</span>
			<strong>${avgText} / 5</strong>
		</div>
		<div class="stat-pill">
			<span class="dot"></span>
			<span>Total</span>
			<strong>${stats.count}</strong>
		</div>
	</div>

	<!-- Section label -->
	<div class="section-label">Recent feedback</div>

	<!-- Cards -->
	<div class="cards">
		${cards || '<div class="empty">No feedback found.</div>'}
	</div>
</main>
</body>
</html>`;
};

module.exports.get = () => ({
	path: '/rating',
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		let user = null;
		try { user = await req.jwtVerify(); } catch {}
		const q = String(req.query.q || '').trim();

		const numQ = Number(q);
		const orFilters = [];
		if (q) {
			orFilters.push({ ticketId: q });
			orFilters.push({ userId: q });
			if (Number.isFinite(numQ)) orFilters.push({ ticket: { number: numQ } });
			orFilters.push({
				ticket: {
					archivedUsers: {
						some: {
							OR: [
								{ username: { contains: q } },
								{ displayName: { contains: q } },
							],
						},
					},
				},
			});
		}
		const where = orFilters.length ? { OR: orFilters } : {};

		const aggregate = await client.prisma.feedback.aggregate({
			_sum: { rating: true },
			_count: { _all: true },
			where,
		});

		const feedback = await client.prisma.feedback.findMany({
			include: {
				guild: true,
				ticket: { select: { id: true, number: true, category: { select: { name: true } } } },
				user: true,
			},
			orderBy: { createdAt: 'desc' },
			where,
			take: 48,
		});

		const entries = [];
		for (const f of feedback) {
			let canDelete = false;
			let raterDisplay = f.user?.username || f.user?.id || 'Unknown';
			let raterId = f.userId || null;
			let raterRole = null;
			let raterRoleColor = null;
			if (user) {
				const guild = client.guilds.cache.get(f.guildId);
				if (guild) {
					const member = await guild.members.fetch(user.id).catch(() => null);
					if (member) {
						const { getPrivilegeLevel } = require('../lib/users');
						const level = await getPrivilegeLevel(member);
						canDelete = level >= 2;
					}
					if (f.userId) {
						const raterMember = await guild.members.fetch(f.userId).catch(() => null);
						if (raterMember) {
							raterDisplay = raterMember.displayName || raterDisplay;
							raterRole = raterMember.roles.highest?.name || null;
							raterRoleColor = raterMember.roles.highest?.hexColor || null;
						}
					}
				}
			}
			entries.push({
				canDelete,
				comment: (() => {
					if (!f.comment) return null;
					try { return decrypt(f.comment); } catch { return f.comment; }
				})(),
				guildName: f.guild?.name || f.guildId,
				raterDisplay,
				raterId,
				raterRole,
				raterRoleColor,
				rating: f.rating,
				ticketId: f.ticketId,
				ticketLabel: `${f.ticket?.category?.name || 'Ticket'} #${f.ticket?.number ?? f.ticketId}`,
				when: new Intl.DateTimeFormat(['en-GB'], { dateStyle: 'medium', timeStyle: 'short' }).format(f.createdAt),
			});
		}

		const html = renderPage({ count: aggregate._count?._all || 0, sum: aggregate._sum.rating || 0 }, entries, q);
		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(html);
	},
});

module.exports.post = () => ({
	path: '/rating/delete',
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		let user;
		try {
			user = await req.jwtVerify();
		} catch {
			return res.code(401).send('Unauthorised');
		}
		const ticketId = String(req.body.ticket || '').trim();
		if (!ticketId) return res.code(400).send('Missing ticket');

		const feedback = await client.prisma.feedback.findUnique({ where: { ticketId } });
		if (!feedback) return res.code(404).send('Not found');

		const guild = client.guilds.cache.get(feedback.guildId);
		if (!guild) return res.code(403).send('Guild unavailable');
		const member = await guild.members.fetch(user.id).catch(() => null);
		if (!member) return res.code(403).send('Forbidden');
		const { getPrivilegeLevel } = require('../lib/users');
		const level = await getPrivilegeLevel(member);
		if (level < 2) return res.code(403).send('Forbidden');

		await client.prisma.feedback.delete({ where: { ticketId } });
		return res.redirect('/rating');
	},
});
