const { ChannelType } = require('discord.js');
const {
	authorise,
	escapeHtml,
	renderLayout,
} = require('../../../lib/pages');
const {
	EVENT_DEFAULTS,
	getEventCategory,
	saveEventSettings,
} = require('../../../lib/events');
const { buildTranscriptUrls } = require('../../../lib/transcript');

const relative = date => {
	const diff = Date.now() - new Date(date).getTime();
	const mins = Math.round(diff / 60000);
	if (mins < 60) return `${Math.max(mins, 1)}m ago`;
	const hours = Math.round(mins / 60);
	if (hours < 48) return `${hours}h ago`;
	return `${Math.round(hours / 24)}d ago`;
};

const roleChips = (guild, name, selected) => {
	const roles = [...guild.roles.cache.values()]
		.filter(r => r.id !== guild.id && !r.managed)
		.sort((a, b) => b.position - a.position);
	if (!roles.length) return '<p class="muted">No roles found.</p>';
	return `<div class="chips">${roles.map(r => {
		const colour = r.hexColor && r.hexColor !== '#000000' ? r.hexColor : '#969cac';
		return `<label class="chip"><input type="checkbox" name="${name}" value="${r.id}"${selected.includes(r.id) ? ' checked' : ''}><span style="--c:${colour}"><i></i>${escapeHtml(r.name)}</span></label>`;
	}).join('')}</div>`;
};

const teamOf = (guild, ticket) => {
	const channel = guild.channels.cache.get(ticket.id);
	const ids = channel
		? [...channel.permissionOverwrites.cache.values()].filter(o => o.type === 1 && o.id !== guild.client.user.id).map(o => o.id)
		: [ticket.createdById];
	return ids.map(id => {
		const member = guild.members.cache.get(id);
		return `<span class="person">${member ? `<img src="${escapeHtml(member.displayAvatarURL({ size: 32 }))}" alt="">` : '<span class="ph"></span>'}${escapeHtml(member?.displayName ?? id)}</span>`;
	}).join('');
};

const eventName = (guild, ticket) => {
	const topic = guild.channels.cache.get(ticket.id)?.topic || '';
	const parts = topic.split(' | ');
	return parts.length > 1 ? parts[1] : null;
};

const render = ({
	guild, category, managerRoles, open, recent, saved, error,
}) => {
	const categories = [...guild.channels.cache.values()]
		.filter(c => c.type === ChannelType.GuildCategory)
		.sort((a, b) => a.position - b.position);
	const current = category ?? EVENT_DEFAULTS;
	const missingChannel = category && !guild.channels.cache.has(category.discordCategory);

	const openRows = open.length
		? `<table class="table"><thead><tr><th>Channel</th><th>Event</th><th>Team</th><th>Opened</th></tr></thead><tbody>${open.map(t => `<tr><td><a class="link" href="https://discord.com/channels/${guild.id}/${t.id}" target="_blank" rel="noopener">#${escapeHtml(guild.channels.cache.get(t.id)?.name ?? t.number)}</a></td><td>${escapeHtml(eventName(guild, t) ?? '—')}</td><td><div class="team">${teamOf(guild, t)}</div></td><td class="muted">${relative(t.createdAt)}</td></tr>`).join('')}</tbody></table>`
		: '<p class="muted">No teams are signed up right now.</p>';

	const recentRows = recent.length
		? `<ul class="simple">${recent.map(t => {
			const urls = buildTranscriptUrls(t.id);
			return `<li><span>#${t.number}</span><span class="muted">closed ${relative(t.closedAt)}</span><a class="link" href="${escapeHtml(urls.viewUrl)}">Transcript →</a></li>`;
		}).join('')}</ul>`
		: '<p class="muted">No finished event tickets yet.</p>';

	return `
	<div class="page-head">
		<div>
			<h1>Events</h1>
			<p class="muted">Team sign-ups for your events. Staff post a panel with <code>/event panel</code> and players join with a button.</p>
		</div>
		${category ? `<a class="btn ghost" href="/settings/${guild.id}/categories/${category.id}">Questions &amp; advanced options</a>` : ''}
	</div>
	${saved ? '<div class="notice ok">Saved. New sign-ups will use these settings.</div>' : ''}
	${error ? `<div class="notice err">${escapeHtml(error)}</div>` : ''}
	${!category ? '<div class="notice">Events are not set up yet. Pick a Discord category below and save to turn them on.</div>' : ''}
	${missingChannel ? '<div class="notice err">The Discord category for event tickets was deleted. Pick a new one below.</div>' : ''}

	<section class="kpis small">
		<div class="kpi"><span class="kpi-label">Teams signed up</span><span class="kpi-value">${open.length}</span></div>
		<div class="kpi"><span class="kpi-label">Players in teams</span><span class="kpi-value">${open.reduce((n, t) => n + (guild.channels.cache.get(t.id)?.permissionOverwrites.cache.filter(o => o.type === 1 && o.id !== guild.client.user.id).size ?? 1), 0)}</span></div>
		<div class="kpi"><span class="kpi-label">Finished</span><span class="kpi-value">${recent.length}${recent.length === 10 ? '+' : ''}</span></div>
	</section>

	<form method="post" class="card form">
		<div class="card-head"><h2>Settings</h2></div>
		<div class="field">
			<label for="discordCategory">Ticket category</label>
			<p class="hint">The Discord category that event tickets are created in.</p>
			<select id="discordCategory" name="discordCategory" required>
				<option value="" disabled${category && !missingChannel ? '' : ' selected'}>Select a category</option>
				${categories.map(c => `<option value="${c.id}"${category?.discordCategory === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
			</select>
		</div>
		<div class="field">
			<label>Event staff</label>
			<p class="hint">These roles can see and reply in every event ticket.</p>
			${roleChips(guild, 'staffRoles', current.staffRoles ?? [])}
		</div>
		<div class="field">
			<label>Can post event panels</label>
			<p class="hint">Members with these roles can use <code>/event panel</code>. Admins and any role named "Event Manager" always can. Joining an event needs no role.</p>
			${roleChips(guild, 'managerRoles', managerRoles)}
		</div>
		<div class="field">
			<label>Ping on sign-up</label>
			<p class="hint">Roles mentioned when a new team signs up.</p>
			${roleChips(guild, 'pingRoles', current.pingRoles ?? [])}
		</div>
		<div class="grid-2 tight">
			<div class="field">
				<label for="channelName">Channel name</label>
				<p class="hint"><code>{team}</code> = player names, <code>{event}</code> = event short name, <code>{number}</code> = ticket number.</p>
				<input id="channelName" name="channelName" maxlength="100" value="${escapeHtml(current.channelName)}">
			</div>
			<div class="field">
				<label for="totalLimit">Max open teams</label>
				<p class="hint">Stop sign-ups when this many event tickets are open.</p>
				<input id="totalLimit" name="totalLimit" type="number" min="1" max="500" value="${escapeHtml(current.totalLimit)}">
			</div>
		</div>
		<div class="field">
			<label for="openingMessage">Opening message</label>
			<p class="hint">Posted at the top of every event ticket. <code>{username}</code> mentions the player who signed up.</p>
			<textarea id="openingMessage" name="openingMessage" rows="4" maxlength="4000">${escapeHtml(current.openingMessage)}</textarea>
		</div>
		<div class="actions"><button class="btn" type="submit">Save settings</button></div>
	</form>

	<section class="card">
		<div class="card-head"><h2>Signed-up teams</h2></div>
		${openRows}
	</section>

	<div class="grid-2">
		<section class="card">
			<div class="card-head"><h2>Recently finished</h2><a class="link" href="/transcripts">Ticket history →</a></div>
			${recentRows}
		</section>
		<section class="card howto">
			<div class="card-head"><h2>Running an event</h2></div>
			<ol>
				<li>Save the settings on this page (or run <code>/event setup</code>).</li>
				<li>In the event channel, run <code>/event panel title:Puzzle Night team-size:4</code>.</li>
				<li>Players press <b>Join event</b>, pick teammates or play solo, and get a private ticket like <code>frozedy-alex-puzzles</code>.</li>
			</ol>
		</section>
	</div>`;
};

const loadPage = async (ctx, extra = {}) => {
	const {
		client, guild,
	} = ctx;
	const category = await getEventCategory(client, guild.id);
	const settings = await client.prisma.guild.findUnique({
		select: { eventManagerRoles: true },
		where: { id: guild.id },
	});
	const [open, recent] = category
		? await Promise.all([
			client.prisma.ticket.findMany({
				orderBy: { createdAt: 'desc' },
				select: {
					createdAt: true,
					createdById: true,
					id: true,
					number: true,
				},
				where: {
					categoryId: category.id,
					open: true,
				},
			}),
			client.prisma.ticket.findMany({
				orderBy: { closedAt: 'desc' },
				select: {
					closedAt: true,
					id: true,
					number: true,
				},
				take: 10,
				where: {
					categoryId: category.id,
					open: false,
				},
			}),
		])
		: [[], []];
	return renderLayout({
		active: 'events',
		body: render({
			category,
			guild,
			managerRoles: Array.isArray(settings?.eventManagerRoles) ? settings.eventManagerRoles : [],
			open,
			recent,
			...extra,
		}),
		guild,
		title: 'Events',
		user: ctx.user,
	});
};

module.exports.get = () => ({
	handler: async (req, res) => {
		const ctx = await authorise(req, res, 2);
		if (!ctx) return res;
		return res
			.type('text/html; charset=utf-8')
			.send(await loadPage(ctx, { saved: req.query.saved === '1' }));
	},
});

module.exports.post = () => ({
	handler: async (req, res) => {
		const ctx = await authorise(req, res, 2);
		if (!ctx) return res;
		const body = req.body || {};
		const discordCategory = String(body.discordCategory || '');
		const channel = ctx.guild.channels.cache.get(discordCategory);
		if (!channel || channel.type !== ChannelType.GuildCategory) {
			return res
				.code(400)
				.type('text/html; charset=utf-8')
				.send(await loadPage(ctx, { error: 'Pick a valid Discord category for event tickets.' }));
		}
		const validRoles = value => [].concat(value ?? []).map(String).filter(id => ctx.guild.roles.cache.has(id));
		await saveEventSettings(ctx.client, ctx.guild, {
			channelName: String(body.channelName || '').trim() || EVENT_DEFAULTS.channelName,
			discordCategory,
			managerRoles: validRoles(body.managerRoles),
			openingMessage: String(body.openingMessage || '').trim() || EVENT_DEFAULTS.openingMessage,
			pingRoles: validRoles(body.pingRoles),
			staffRoles: validRoles(body.staffRoles),
			totalLimit: body.totalLimit,
		});
		return res.redirect(`/settings/${ctx.guild.id}/events?saved=1`);
	},
});
