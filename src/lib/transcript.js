const fs = require('fs');
const fsp = fs.promises;
const { join } = require('path');
const { randomBytes } = require('crypto');
const Mustache = require('mustache');
const ms = require('ms');
const { PermissionsBitField } = require('discord.js');
const { pools } = require('./threads');
const { isStaff } = require('./users');
const { existsSync } = require('fs');

const TEMPLATE_CACHE = {};
const TOKEN_PREFIX = 'transcript-token:';
const TOKEN_TTL = ms('7d');
const urlRegex = /(https?:\/\/[^\s]+)/g;
const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

const BASE_TRANSCRIPT_INCLUDE = {
	archivedChannels: true,
	archivedMessages: {
		orderBy: { createdAt: 'asc' },
		where: { external: false },
	},
	archivedRoles: true,
	archivedUsers: true,
	category: true,
	claimedBy: true,
	closedBy: true,
	createdBy: true,
	feedback: true,
	guild: true,
	questionAnswers: { include: { question: true } },
};

const escapeHtml = text => (text ?? '')
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#39;');

const linkify = text => text
	.split(urlRegex)
	.map((segment, index) => {
		if (index % 2 === 1) {
			const safe = escapeHtml(segment);
			return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
		}
		return escapeHtml(segment);
	})
	.join('');

const resolveAvatar = author => {
	if (!author) return DEFAULT_AVATAR;
	if (author.avatar?.startsWith?.('http')) return author.avatar;
	if (author.userId && author.avatar) {
		return `https://cdn.discordapp.com/avatars/${author.userId}/${author.avatar}.png?size=512`;
	}
	return DEFAULT_AVATAR;
};

const sanitizeFileName = input => {
	const safe = (input || 'transcript')
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim()
		.slice(0, 80);
	return safe || 'transcript';
};

const getTemplateName = (config, key, fallback) => {
	if (config?.templates?.[key]) return config.templates[key];
	return fallback;
};

const loadTemplate = name => {
	const candidates = [
		join('./public', name),
		join('./public', `${name}.html`),
		join('./public', `${name}.md`),
		join('./user/templates', name),
		join('./user/templates', `${name}.mustache`),
	];

	for (const file of candidates) {
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, 'utf8');
		}
	}

	throw new Error(`Transcript template "${name}" not found in public/ or user/templates/`);
};

let appCss;
const getAppCss = () => {
	if (appCss) return appCss;
	const assetsDir = join(process.cwd(), 'node_modules/@discord-tickets/settings/build/client/_app/immutable/assets');
	if (existsSync(assetsDir)) {
		const files = fs.readdirSync(assetsDir).filter(f => /^0\..*\.css$/.test(f));
		if (files.length > 0) {
			const cssPath = join(assetsDir, files[0]);
			appCss = fs.readFileSync(cssPath, 'utf8');
		}
	}
	appCss ||= '';
	return appCss;
};

const getFormatters = locale => ({
	full: new Intl.DateTimeFormat([locale, 'en-GB'], {
		dateStyle: 'full',
		timeStyle: 'long',
		timeZone: 'Etc/UTC',
	}),
	short: new Intl.DateTimeFormat([locale, 'en-GB'], {
		dateStyle: 'short',
		timeStyle: 'long',
		timeZone: 'Etc/UTC',
	}),
});

const buildChannelName = ticket => {
	const template = ticket.category?.channelName || `ticket-${ticket.number || ticket.id}`;
	return template
		.replace(/{+\s?(user)?name\s?}+/gi, ticket.createdBy?.username)
		.replace(/{+\s?(nick|display)(name)?\s?}+/gi, ticket.createdBy?.displayName)
		.replace(/{+\s?num(ber)?\s?}+/gi, ticket.number);
};

async function fetchTranscriptTicket(client, ticketId, guildId) {
	return await client.prisma.ticket.findUnique({
		include: BASE_TRANSCRIPT_INCLUDE,
		where: guildId && ticketId.length < 16
			? {
				guildId_number: {
					guildId,
					number: parseInt(ticketId),
				},
			}
			: { id: ticketId },
	});
}

async function buildTranscriptViewModel(client, ticket) {
	const hydrated = await pools.transcript.queue(w => w(ticket));
	const channelName = buildChannelName(hydrated);
	const { full, short } = getFormatters(hydrated.guild.locale);

	hydrated.closedAtFull = function () {
		return this.closedAt ? full.format(this.closedAt) : '';
	};
	hydrated.createdAtFull = function () {
		return this.createdAt ? full.format(this.createdAt) : '';
	};
	hydrated.createdAtTimestamp = function () {
		return this.createdAt ? short.format(this.createdAt) : '';
	};

	const messagesHtml = hydrated.archivedMessages.map(message => {
		const authorName = message.author?.displayName || message.author?.username || message.authorId || 'Unknown author';
		const content = message.text ?? '';
		const contentHtml = linkify(content)
			.replace(/\n/g, '<br>')
			.replace(/\t/g, '&nbsp;&nbsp;') || '<span class="muted">[no content]</span>';
		return {
			avatar: escapeHtml(resolveAvatar(message.author)),
			author: escapeHtml(authorName),
			contentHtml,
			number: message.number,
			timestamp: short.format(message.createdAt),
		};
	});

	const mdTemplateName = getTemplateName(client.config, 'transcript', 'transcript.md');
	const mdExtension = mdTemplateName.split('.').pop() || 'md';
	const mdFileName = `${sanitizeFileName(channelName)}-${hydrated.id}.${mdExtension}`;

	return {
		channelName,
		generatedAt: new Date().toISOString(),
		guildName: client.guilds.cache.get(hydrated.guildId)?.name ?? hydrated.guild?.name ?? 'Unknown guild',
		mdFileName,
		messagesHtml,
		pinned: hydrated.pinnedMessageIds.filter(Boolean).join(', '),
		participants: hydrated.archivedUsers.map(user => ({
			avatar: escapeHtml(resolveAvatar(user)),
			displayName: escapeHtml(user.displayName || user.username || user.userId || 'User'),
			id: user.userId || 'unknown',
		})),
		appCss: getAppCss(),
		ticket: hydrated,
	};
}

function renderMarkdown(client, viewModel) {
	const templateName = getTemplateName(client.config, 'transcript', 'transcript.md');
	const template = loadTemplate(templateName);
	return Mustache.render(template, viewModel);
}

function renderHtml(client, viewModel) {
	const templateName = getTemplateName(client.config, 'transcriptHtml', 'transcript.html');
	const template = loadTemplate(templateName);
	return Mustache.render(template, viewModel);
}

function baseUrl() {
	return process.env.HTTP_EXTERNAL || process.env.ORIGIN || process.env.HTTP_INTERNAL || '';
}

function buildTranscriptUrls(ticketId, token) {
	const tokenQuery = token ? `?token=${token}` : '';
	return {
		downloadUrl: `${baseUrl()}/transcripts/${ticketId}/download${tokenQuery}`,
		viewUrl: `${baseUrl()}/transcripts/${ticketId}${tokenQuery}`,
	};
}

async function createTranscriptUrls(client, ticketId) {
	const token = randomBytes(24).toString('hex');
	await client.keyv.set(TOKEN_PREFIX + token, { ticketId }, TOKEN_TTL);
	return { token, ...buildTranscriptUrls(ticketId, token) };
}

async function validateTranscriptToken(client, token, ticketId) {
	if (!token) return false;
	const cached = await client.keyv.get(TOKEN_PREFIX + token);
	return cached?.ticketId === ticketId;
}

async function hasTranscriptAccess(client, ticket, userId) {
	if (!userId) return false;
	if (ticket.createdById === userId) return true;

	const guild = client.guilds.cache.get(ticket.guildId);
	if (!guild) return false;
	const member = await guild.members.fetch(userId).catch(() => null);
	if (!member) return false;
	if (client.supers.includes(member.id)) return true;
	if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
	if (ticket.category?.staffRoles?.length) {
		if (member.roles.cache.some(role => ticket.category.staffRoles.includes(role.id))) return true;
	}
	return await isStaff(guild, member.id);
}

async function ensureMarkdownBackup(fileName, content) {
	await fsp.mkdir('./user/transcripts', { recursive: true });
	await fsp.writeFile(join('./user/transcripts', fileName), content);
}

module.exports = {
	buildTranscriptUrls,
	buildTranscriptViewModel,
	createTranscriptUrls,
	ensureMarkdownBackup,
	fetchTranscriptTicket,
	hasTranscriptAccess,
	renderHtml,
	renderMarkdown,
	validateTranscriptToken,
};
