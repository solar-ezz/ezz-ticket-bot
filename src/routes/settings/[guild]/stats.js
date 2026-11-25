const {
	authorise,
	escapeHtml,
	renderLayout,
} = require('../../../lib/pages');
const { getGuildStats } = require('../../../lib/guild-stats');

const fmtDate = (date, withYear) => new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	...(withYear ? { year: 'numeric' } : {}),
}).format(date);

const lineChart = (series, bucketSize) => {
	const width = 760;
	const height = 220;
	const pad = {
		bottom: 26,
		left: 34,
		right: 10,
		top: 12,
	};
	const max = Math.max(1, ...series.map(p => Math.max(p.created, p.closed)));
	const niceMax = Math.ceil(max / 4) * 4 || 4;
	const innerW = width - pad.left - pad.right;
	const innerH = height - pad.top - pad.bottom;
	const x = i => pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
	const y = v => pad.top + innerH - (v / niceMax) * innerH;
	const path = key => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
	const area = `${path('created')} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
	const grid = [0, 1, 2, 3, 4].map(i => {
		const v = (niceMax / 4) * i;
		return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.left - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${Math.round(v)}</text>`;
	}).join('');
	const step = Math.max(1, Math.ceil(series.length / 7));
	const labels = series.map((p, i) => (i % step === 0 || i === series.length - 1)
		? `<text x="${x(i)}" y="${height - 6}" class="axis" text-anchor="middle">${fmtDate(p.date)}</text>`
		: '').join('');
	const hits = series.map((p, i) => `<g class="hit"><rect x="${x(i) - innerW / series.length / 2}" y="${pad.top}" width="${innerW / series.length}" height="${innerH}" fill="transparent"/><circle cx="${x(i)}" cy="${y(p.created)}" r="3.5" class="dot created"/><title>${bucketSize > 1 ? 'Week to ' : ''}${fmtDate(p.date, true)}: ${p.created} opened, ${p.closed} closed</title></g>`).join('');
	return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Tickets opened and closed over time">
		<defs><linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5cff" stop-opacity=".35"/><stop offset="1" stop-color="#7c5cff" stop-opacity="0"/></linearGradient></defs>
		${grid}
		<path d="${area}" fill="url(#fillCreated)"/>
		<path d="${path('created')}" class="line created"/>
		<path d="${path('closed')}" class="line closed"/>
		${labels}${hits}
	</svg>`;
};

const columnChart = (items, labelKey, valueKey, { highlightMax = true } = {}) => {
	const max = Math.max(1, ...items.map(i => i[valueKey]));
	const top = Math.max(...items.map(i => i[valueKey]));
	return `<div class="columns">${items.map(item => {
		const v = item[valueKey];
		const pct = Math.round((v / max) * 100);
		return `<div class="col${highlightMax && v === top && v > 0 ? ' peak' : ''}" title="${escapeHtml(item[labelKey])}: ${v}"><div class="bar" style="height:${Math.max(pct, v ? 4 : 0)}%"></div><span>${escapeHtml(item[labelKey])}</span></div>`;
	}).join('')}</div>`;
};

const barList = (items, empty) => {
	const max = Math.max(1, ...items.map(i => i.value));
	if (!items.length || items.every(i => !i.value)) return `<p class="muted">${empty}</p>`;
	return `<ul class="barlist">${items.map(i => `<li><div class="bl-head"><span class="bl-label">${i.label}</span><span class="bl-value">${i.display ?? i.value}</span></div><div class="bl-track"><div class="bl-fill" style="width:${Math.round((i.value / max) * 100)}%"></div></div></li>`).join('')}</ul>`;
};

const stars = n => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(5 - n) + '</span>';

const kpi = (label, value, sub) => `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${sub ? `<span class="kpi-sub">${sub}</span>` : ''}</div>`;

const render = (s, guild) => {
	const rangeLinks = s.ranges.map(d => `<a href="?days=${d}"${d === s.days ? ' class="active"' : ''}>${d === 365 ? '1y' : `${d}d`}</a>`).join('');
	const hours = s.hours.map((count, h) => ({
		count,
		label: h % 3 === 0 ? String(h).padStart(2, '0') : '',
		title: `${String(h).padStart(2, '0')}:00`,
	}));
	const staffRows = s.topStaff.length
		? `<table class="table"><thead><tr><th>Staff</th><th>Claimed</th><th>Closed</th></tr></thead><tbody>${s.topStaff.map(m => `<tr><td><span class="person">${m.avatar ? `<img src="${escapeHtml(m.avatar)}" alt="">` : '<span class="ph"></span>'}${escapeHtml(m.name)}</span></td><td>${m.claimed}</td><td>${m.closed}</td></tr>`).join('')}</tbody></table>`
		: '<p class="muted">No staff activity in this period yet.</p>';
	const feedback = s.recentFeedback.length
		? `<ul class="feedback">${s.recentFeedback.map(f => `<li><div class="fb-head"><span class="stars">${stars(f.rating)}</span><span class="muted">#${escapeHtml(f.number ?? '?')} · ${escapeHtml(f.user)} · ${fmtDate(f.createdAt, true)}</span></div><p>${escapeHtml(f.comment)}</p></li>`).join('')}</ul>`
		: '<p class="muted">No written feedback in this period.</p>';

	return `
	<div class="page-head">
		<div>
			<h1>Stats</h1>
			<p class="muted">How ${escapeHtml(guild.name)}'s tickets are doing over the last ${s.days === 365 ? 'year' : `${s.days} days`}.</p>
		</div>
		<div class="segmented" role="tablist">${rangeLinks}</div>
	</div>

	<section class="kpis">
		${kpi('Opened', s.created, `${s.uniqueOpeners} unique member${s.uniqueOpeners === 1 ? '' : 's'}`)}
		${kpi('Closed', s.closed)}
		${kpi('Open now', s.openNow, `${s.allTime} all time`)}
		${kpi('First response', s.avgResponse, s.responseRate === null ? '' : `${s.responseRate}% answered`)}
		${kpi('Resolution', s.avgResolution, 'average time to close')}
		${kpi('Rating', s.avgRating ? `${s.avgRating}<small>/5</small>` : '—', `${s.ratingsCount} rating${s.ratingsCount === 1 ? '' : 's'}`)}
	</section>

	<section class="card">
		<div class="card-head"><h2>Tickets over time</h2><div class="legend"><span class="lg created"></span>Opened<span class="lg closed"></span>Closed</div></div>
		${lineChart(s.series, s.bucketSize)}
	</section>

	<div class="grid-2">
		<section class="card">
			<div class="card-head"><h2>By category</h2>${s.eventSignups ? `<span class="pill">🎉 ${s.eventSignups} event sign-up${s.eventSignups === 1 ? '' : 's'}</span>` : ''}</div>
			${barList(s.byCategory.map(c => ({
		label: `${/^\d+$/.test(c.emoji || '') ? '' : escapeHtml(c.emoji || '')} ${escapeHtml(c.name)}${c.event ? ' <span class="tag">event</span>' : ''}`,
		value: c.count,
	})), 'No tickets in this period.')}
		</section>
		<section class="card">
			<div class="card-head"><h2>Ratings</h2><a class="link" href="/rating">All ratings →</a></div>
			${barList([5, 4, 3, 2, 1].map(n => ({
		label: `<span class="stars">${stars(n)}</span>`,
		value: s.ratings[n - 1],
	})), 'No ratings in this period.')}
		</section>
	</div>

	<div class="grid-2">
		<section class="card">
			<div class="card-head"><h2>Busiest hours</h2><span class="muted small">${escapeHtml(s.timeZone)}</span></div>
			${columnChart(hours.map(h => ({
		count: h.count,
		label: h.label,
	})), 'label', 'count')}
		</section>
		<section class="card">
			<div class="card-head"><h2>Busiest days</h2></div>
			${columnChart(s.weekdays, 'day', 'count')}
		</section>
	</div>

	<div class="grid-2">
		<section class="card">
			<div class="card-head"><h2>Top staff</h2></div>
			${staffRows}
		</section>
		<section class="card">
			<div class="card-head"><h2>Recent feedback</h2></div>
			${feedback}
		</section>
	</div>`;
};

module.exports.get = () => ({
	handler: async (req, res) => {
		const ctx = await authorise(req, res, 1);
		if (!ctx) return res;
		const stats = await getGuildStats(ctx.client, ctx.guild, req.query.days);
		return res
			.type('text/html; charset=utf-8')
			.send(renderLayout({
				active: 'stats',
				body: render(stats, ctx.guild),
				guild: ctx.guild,
				title: 'Stats',
				user: ctx.user,
			}));
	},
});
