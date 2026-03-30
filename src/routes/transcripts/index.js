const { buildTranscriptUrls, hasTranscriptAccess } = require('../../lib/transcript');

const perPage = 14;
const icons = {
	view: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
	download: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12.586l3.293-3.293 1.414 1.414L12 19.414l-4.707-4.707 1.414-1.414L11 15.586V3h2z"/><path d="M5 19h14v2H5z"/></svg>',
};

const escapeHtml = value => String(value ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const parseDateInput = input => {
	if (!input) return null;
	const dt = new Date(input);
	return Number.isNaN(dt.getTime()) ? null : dt;
};

const endOfDay = date => {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
};

module.exports.get = () => ({
	path: '/transcripts',
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		let user;
		try {
			user = await req.jwtVerify();
		} catch {
			const redirect = encodeURIComponent(req.url);
			return res.redirect(`/auth/login?r=${redirect}`);
		}

		const filters = {
			ticket: (req.query.ticket || '').trim(),
			opener: (req.query.opener || '').trim(),
			category: (req.query.category || '').trim(),
			createdFrom: (req.query.createdFrom || '').trim(),
			createdTo: (req.query.createdTo || '').trim(),
		};

		const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
		const skip = (page - 1) * perPage;

		const where = { closedAt: { not: null } };

		const createdAt = {};
		const createdFrom = parseDateInput(filters.createdFrom);
		const createdTo = parseDateInput(filters.createdTo);
		if (createdFrom) createdAt.gte = createdFrom;
		if (createdTo) createdAt.lte = endOfDay(createdTo);
		if (Object.keys(createdAt).length) where.createdAt = createdAt;

		if (filters.category) {
			const categoryId = parseInt(filters.category, 10);
			if (!Number.isNaN(categoryId)) {
				where.categoryId = categoryId;
			} else {
				where.category = { name: { contains: filters.category, mode: 'insensitive' } };
			}
		}

		if (filters.opener) {
			if (/^\d{5,20}$/.test(filters.opener)) {
				where.createdById = filters.opener;
			} else {
				where.archivedUsers = {
					some: {
						OR: [
							{ username: { contains: filters.opener, mode: 'insensitive' } },
							{ displayName: { contains: filters.opener, mode: 'insensitive' } },
						],
					},
				};
			}
		}

		const ticketSearch = filters.ticket.replace(/^#/, '');
		if (ticketSearch) {
			const numeric = parseInt(ticketSearch, 10);
			if (!Number.isNaN(numeric) && ticketSearch.length <= 8) {
				where.number = numeric;
			} else {
				where.id = ticketSearch;
			}
		}

		const total = await client.prisma.ticket.count({ where });

		const avatarUrl = user.avatar && user.avatar.startsWith('http')
			? user.avatar
			: (user.avatar && user.id)
				? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
				: 'https://cdn.discordapp.com/embed/avatars/0.png';

		const tickets = await client.prisma.ticket.findMany({
			include: { category: true, guild: true, createdBy: true, archivedUsers: true },
			orderBy: { closedAt: 'desc' },
			skip,
			take: perPage * 10,
			where,
		});

		const rows = [];
		for (const ticket of tickets) {
			if (!await hasTranscriptAccess(client, ticket, user.id)) continue;
			const urls = buildTranscriptUrls(ticket.id);
			const archivedOpener = ticket.archivedUsers?.find(u => u.userId === ticket.createdById) || ticket.archivedUsers?.[0];
			const openerName = archivedOpener?.username || archivedOpener?.displayName || ticket.createdBy?.username || ticket.createdBy?.displayName || ticket.createdById || 'Unknown';
			rows.push({
				id: ticket.id,
				number: ticket.number,
				openerName,
				openerId: ticket.createdById,
				category: ticket.category?.name || 'Unknown',
				guild: ticket.guild?.name || ticket.guildId,
				createdAt: ticket.createdAt,
				closedAt: ticket.closedAt,
				viewUrl: urls.viewUrl,
				downloadUrl: urls.downloadUrl,
			});
			if (rows.length >= perPage) break;
		}

		const pages = Math.max(1, Math.ceil(total / perPage));
		const formatDate = date => date ? new Intl.DateTimeFormat(['en-GB'], {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(date) : '--';

		const pageLink = target => {
			const params = new URLSearchParams();
			params.set('page', target);
			Object.entries(filters).forEach(([key, value]) => {
				if (value) params.set(key, value);
			});
			return `/transcripts?${params.toString()}`;
		};

		const rowsHtml = rows.map(r => `<tr>
						<td><span class="badge">${escapeHtml(r.id)}</span></td>
						<td>${r.number ?? '--'}</td>
						<td>${escapeHtml(r.guild)}</td>
						<td>${escapeHtml(r.category)}</td>
						<td>
							<div class="stack">
								<span class="strong opener-name">${escapeHtml(r.openerName)}</span>
								<span class="muted opener-id">ID: ${escapeHtml(r.openerId || '--')}</span>
							</div>
						</td>
						<td>${formatDate(r.createdAt)}</td>
						<td>${formatDate(r.closedAt)}</td>
						<td class="meta"><a href="${r.viewUrl}">${icons.view} View</a><a href="${r.downloadUrl}">${icons.download} MD</a></td>
					</tr>`).join('') || '<tr><td colspan="8">No transcripts match your filters.</td></tr>';

		const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Transcripts</title>
	<style>
		:root { --bg:#05060a; --panel:#0f1118; --panel2:#151824; --border:#1f2330; --text:#e7e9f0; --muted:#a7abba; --accent:#6c7bff; }
		* { box-sizing:border-box; }
		body { margin:0; font-family: "Inter", system-ui, -apple-system, sans-serif; background:radial-gradient(120% 120% at 0% 0%, rgba(108,123,255,0.12), transparent 40%), var(--bg); color:var(--text); }
		.wrap { max-width: 1100px; margin: 32px auto 48px; padding: 0 18px; }
		header { margin-bottom: 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
		h1 { margin:0; font-size: 24px; letter-spacing:-0.02em; }
		.count { color: var(--muted); font-size: 14px; }
		.table-shell { border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--panel); box-shadow:0 18px 40px rgba(0,0,0,0.35); }
		table { width:100%; border-collapse: collapse; }
		th, td { padding:13px 14px; text-align:left; }
		th { background: var(--panel2); color: var(--muted); font-weight:600; border-bottom:1px solid var(--border); font-size:13px; }
		tr + tr td { border-top:1px solid var(--border); }
		tr:hover td { background: rgba(255,255,255,0.03); }
		a { color: var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-weight:600; }
		a:hover { text-decoration:underline; }
		.badge { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:10px; background:#0a0c12; color:var(--muted); font-size:12px; border:1px solid var(--border); }
		.meta { display:flex; gap:12px; align-items:center; }
		nav.pagination { margin-top:14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
		nav.pagination a { padding:7px 11px; border-radius:10px; border:1px solid var(--border); background:var(--panel2); color:var(--text); }
		nav.pagination span { color:var(--muted); font-size:13px; }
		.card { background: var(--panel2); padding: 12px 14px; border:1px solid var(--border); border-radius:10px; color: var(--muted); font-size:13px; }
		.btn-login { padding:7px 11px; border-radius:10px; border:1px solid var(--border); background:var(--panel2); color:var(--text); text-decoration:none; }
		.filters { margin: 16px 0 18px; padding: 14px; border-radius:12px; border:1px solid var(--border); background:var(--panel2); display:flex; flex-direction:column; gap:12px; }
		.filters .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }
		.filters label { display:flex; flex-direction:column; gap:6px; color:var(--muted); font-size:13px; }
		.filters input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--bg); color:var(--text); }
		.filters .range { display:flex; gap:8px; align-items:center; }
		.filters .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
		.filters button { padding:9px 14px; border:none; border-radius:10px; background:var(--accent); color:#fff; font-weight:700; cursor:pointer; }
		.filters a.ghost { padding:9px 14px; border-radius:10px; border:1px solid var(--border); color:var(--text); text-decoration:none; }
		.stack { display:flex; flex-direction:column; gap:2px; }
		.strong { font-weight:600; color:var(--text); }
		.muted { color:var(--muted); font-size:12px; }
		.opener-name { display:block; line-height:1.25; }
		.opener-id { display:block; line-height:1.15; }
	</style>
</head>
<body>
	<div class="wrap">
	<header>
			<div>
				<h1>Transcripts</h1>
				<div class="count">${rows.length} shown | page ${page} of ${pages} | ${total} matching</div>
			</div>
			<div class="meta">
				${user ? `<img src="${avatarUrl}" alt="avatar" style="width:34px;height:34px;border-radius:50%;">` : ''}
				<span>${user.username || ''}</span>
				<a href="/auth/login?r=/transcripts" class="btn-login">Login</a>
			</div>
		</header>
		<form class="filters" method="get" action="/transcripts">
			<div class="grid">
				<label>
					<span>Ticket ID or #</span>
					<input type="text" name="ticket" inputmode="text" placeholder="1234 or 123456789012345678" value="${escapeHtml(filters.ticket)}">
				</label>
				<label>
					<span>Opener username or ID</span>
					<input type="text" name="opener" inputmode="text" placeholder="username or 123..." value="${escapeHtml(filters.opener)}">
				</label>
			</div>
			<div class="grid">
				<label>
					<span>Category (name or ID)</span>
					<input type="text" name="category" inputmode="text" placeholder="Billing or 4" value="${escapeHtml(filters.category)}">
				</label>
				<label>
					<span>Created between</span>
					<div class="range">
						<input type="date" name="createdFrom" value="${escapeHtml(filters.createdFrom)}">
						<span class="muted">to</span>
						<input type="date" name="createdTo" value="${escapeHtml(filters.createdTo)}">
					</div>
				</label>
			</div>
			<div class="actions">
				<button type="submit">Search</button>
				<a class="ghost" href="/transcripts">Clear</a>
			</div>
		</form>
		<div class="table-shell">
			<table>
				<thead>
					<tr>
						<th>ID</th>
						<th>#</th>
						<th>Guild</th>
						<th>Category</th>
						<th>Opened by</th>
						<th>Created</th>
						<th>Closed</th>
						<th>Links</th>
					</tr>
				</thead>
				<tbody>
					${rowsHtml}
				</tbody>
			</table>
		</div>
		<nav class="pagination">
			${page > 1 ? `<a href="${pageLink(page - 1)}">Prev</a>` : ''}
			<span>Page ${page} / ${pages}</span>
			${page < pages ? `<a href="${pageLink(page + 1)}">Next</a>` : ''}
		</nav>
	</div>
</body>
</html>`;
		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(html);
	},
});
