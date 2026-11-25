const { getPrivilegeLevel } = require('./users');
const { iconURL } = require('./misc');

const escapeHtml = value => String(value ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const avatarOf = user => {
	if (user?.avatar?.startsWith?.('http')) return user.avatar;
	if (user?.avatar && user?.id) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
	return 'https://cdn.discordapp.com/embed/avatars/0.png';
};

const NAV = [
	['overview', 'Overview', g => `/settings/${g}`],
	['stats', 'Stats', g => `/settings/${g}/stats`],
	['events', 'Events', g => `/settings/${g}/events`],
	['history', 'Ticket history', () => '/transcripts'],
	['ratings', 'Ratings', () => '/rating'],
];

const renderLayout = ({
	title, guild, user, active, body, head = '',
}) => `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#090a0e">
	<title>${escapeHtml(title)} | Ezz Tickets</title>
	<link rel="icon" type="image/svg+xml" href="/ezz/logo.svg">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
	<link rel="stylesheet" href="/ezz/pages.css?v=2">
	${head}
</head>
<body>
	<div class="shell">
		<header class="topbar">
			<a class="brand" href="/settings"><img src="/ezz/logo.svg" alt=""><span>Ezz <b>Tickets</b></span></a>
			${guild ? `<div class="guild-chip"><img src="${escapeHtml(iconURL(guild))}" alt="">${escapeHtml(guild.name)}</div>` : ''}
			${user ? `<div class="user"><img src="${escapeHtml(avatarOf(user))}" alt=""><span>${escapeHtml(user.username)}</span></div>` : ''}
		</header>
		${guild ? `<nav class="tabs">${NAV.map(([key, label, href]) => `<a href="${href(guild.id)}"${key === active ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}</nav>` : ''}
		<main>${body}</main>
		<footer class="foot">Ezz Tickets</footer>
	</div>
</body>
</html>`;

const renderMessage = (res, status, title, message) => res
	.code(status)
	.type('text/html; charset=utf-8')
	.send(renderLayout({
		body: `<section class="card empty"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a class="btn" href="/settings">Back to dashboard</a></section>`,
		title,
	}));

const authorise = async (req, res, minLevel) => {
	const { client } = req.routeOptions.config;
	let user;
	try {
		user = await req.jwtVerify();
		if (user.expiresAt < Date.now()) throw new Error('expired');
	} catch {
		res.redirect(`/auth/login?r=${encodeURIComponent(req.url)}`);
		return null;
	}
	const guild = client.guilds.cache.get(req.params.guild);
	if (!guild) {
		renderMessage(res, 404, 'Server not found', 'The bot is not in that server.');
		return null;
	}
	const member = await guild.members.fetch(user.id).catch(() => null);
	const level = await getPrivilegeLevel(member);
	if (level < minLevel) {
		renderMessage(res, 403, 'No access', 'You do not have permission to view this page.');
		return null;
	}
	return {
		client,
		guild,
		level,
		member,
		user,
	};
};

module.exports = {
	authorise,
	avatarOf,
	escapeHtml,
	renderLayout,
	renderMessage,
};
