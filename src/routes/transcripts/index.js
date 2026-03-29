const { buildTranscriptUrls, hasTranscriptAccess } = require('../../lib/transcript');

const perPage = 14;
const icons = {
	view: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
	download: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12.586l3.293-3.293 1.414 1.414L12 19.414l-4.707-4.707 1.414-1.414L11 15.586V3h2z"/><path d="M5 19h14v2H5z"/></svg>',
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

		const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
		const skip = (page - 1) * perPage;

		const total = await client.prisma.ticket.count({
			where: { closedAt: { not: null } },
		});

		const avatarUrl = user.avatar && user.avatar.startsWith('http')
			? user.avatar
			: (user.avatar && user.id)
				? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
				: 'https://cdn.discordapp.com/embed/avatars/0.png';

		const tickets = await client.prisma.ticket.findMany({
			include: { category: true, guild: true },
			orderBy: { closedAt: 'desc' },
			skip,
			take: perPage * 10,
			where: { closedAt: { not: null } },
		});

		const rows = [];
		for (const ticket of tickets) {
			// eslint-disable-next-line no-await-in-loop
			if (!await hasTranscriptAccess(client, ticket, user.id)) continue;
			const urls = buildTranscriptUrls(ticket.id);
			rows.push({
				id: ticket.id,
				number: ticket.number,
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
		}).format(date) : '—';

		const pageLink = target => `/transcripts?page=${target}`;

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
	</style>
</head>
<body>
	<div class="wrap">
	<header>
			<div>
				<h1>Transcripts</h1>
				<div class="count">${rows.length} shown · page ${page} of ${pages}</div>
			</div>
			<div class="meta">
				${user ? `<img src="${avatarUrl}" alt="avatar" style="width:34px;height:34px;border-radius:50%;">` : ''}
				<span>${user.username || ''}</span>
				<a href="/auth/login?r=/transcripts" class="btn-login">Login</a>
			</div>
		</header>
		<div class="table-shell">
			<table>
				<thead>
					<tr>
						<th>ID</th>
						<th>#</th>
						<th>Guild</th>
						<th>Category</th>
						<th>Created</th>
						<th>Closed</th>
						<th>Links</th>
					</tr>
				</thead>
				<tbody>
					${rows.map(r => `<tr>
						<td><span class="badge">${r.id}</span></td>
						<td>${r.number ?? '—'}</td>
						<td>${r.guild}</td>
						<td>${r.category}</td>
						<td>${formatDate(r.createdAt)}</td>
						<td>${formatDate(r.closedAt)}</td>
						<td class="meta"><a href="${r.viewUrl}">${icons.view} View</a><a href="${r.downloadUrl}">${icons.download} MD</a></td>
					</tr>`).join('') || '<tr><td colspan="7">No transcripts available.</td></tr>'}
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
