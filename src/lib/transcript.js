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
	archivedUsers: {
		include: { role: true },
	},
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

const isImageUrl = url => {
	const clean = (url || '').split('?')[0].toLowerCase();
	return /\.(png|jpe?g|gif|webp|bmp|apng)$/i.test(clean);
};

const isVideoUrl = url => {
	const clean = (url || '').split('?')[0].toLowerCase();
	return /\.(mp4|webm|mov|m4v|gifv)$/i.test(clean);
};

const mediaKey = url => {
	if (!url) return '';
	return url.split(/[?#]/)[0].toLowerCase();
};

const asEmbeddable = rawUrl => {
	if (!rawUrl) return null;
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		return null;
	}
	const host = url.hostname.toLowerCase();

	if (host.includes('tenor.com')) {
		const match = rawUrl.match(/tenor\.com\/view\/[^/]*-([0-9]+)/i);
		if (match?.[1]) {
			return `<iframe src="https://tenor.com/embed/${match[1]}" class="inline-media iframe-media" frameborder="0" allowtransparency="true" scrolling="no"></iframe>`;
		}
	}

	if (host.includes('giphy.com')) {
		const match = rawUrl.match(/giphy\.com\/gifs\/[^/]*-([A-Za-z0-9]+)/i);
		if (match?.[1]) {
			return `<iframe src="https://giphy.com/embed/${match[1]}" class="inline-media iframe-media" frameborder="0" allow="fullscreen"></iframe>`;
		}
	}

	if (host.includes('imgur.com') && rawUrl.toLowerCase().endsWith('.gifv')) {
		const mp4 = rawUrl.replace(/\.gifv$/i, '.mp4');
		return `<video src="${escapeHtml(mp4)}" class="inline-media video-media" autoplay loop muted playsinline controls></video>`;
	}

	return null;
};

const linkifyWithSeen = (text, seen) => text
	.split(urlRegex)
	.map((segment, index) => {
		if (index % 2 === 1) {
			const safe = escapeHtml(segment);
			const key = mediaKey(segment);
			if (seen.has(key)) return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
			if (isImageUrl(segment)) {
				seen.add(key);
				return `<img src="${safe}" alt="image attachment" class="inline-media">`;
			}
			if (isVideoUrl(segment)) {
				seen.add(key);
				return `<video src="${safe}" class="inline-media video-media" autoplay loop muted playsinline controls></video>`;
			}
			const embed = asEmbeddable(segment);
			if (embed) {
				seen.add(key);
				return embed;
			}
			return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
		}
		return escapeHtml(segment);
	})
	.join('');

const renderEmbed = (embed, seenMedia) => {
	if (!embed) return '';

	const data = embed.data || embed;
	const title = data.title ? `<div class="embed-title">${escapeHtml(data.title)}</div>` : '';
	const description = data.description
		? `<div class="embed-description">${linkifyWithSeen(data.description, seenMedia).replace(/\n/g, '<br>').replace(/(<br>\s*){2,}/gi, '<br>')}</div>`
		: '';
	const fields = Array.isArray(data.fields) && data.fields.length
		? `<div class="embed-fields">${data.fields.map(field => `<div class="embed-field"><div class="embed-field-name">${escapeHtml(field?.name || '')}</div><div class="embed-field-value">${linkifyWithSeen(field?.value || '', seenMedia).replace(/\n/g, '<br>').replace(/(<br>\s*){2,}/gi, '<br>')}</div></div>`).join('')}</div>`
		: '';
	const footer = data.footer?.text ? `<div class="embed-footer">${escapeHtml(data.footer.text)}</div>` : '';
	const author = data.author?.name ? `<div class="embed-author">${escapeHtml(data.author.name)}</div>` : '';

	const mediaCandidates = [
		data.thumbnail?.url,
		data.image?.url,
		data.video?.url,
		embed.thumbnail?.url,
		embed.image?.url,
	].filter(Boolean);

	let media = '';
	const mediaUrl = mediaCandidates[0] || null;
	if (mediaUrl) {
		const key = mediaKey(mediaUrl);
		if (!seenMedia.has(key)) {
			const safeMedia = escapeHtml(mediaUrl);
			if (isVideoUrl(mediaUrl)) {
				media = `<video src="${safeMedia}" class="inline-media video-media" autoplay loop muted playsinline controls></video>`;
			} else {
				media = `<img src="${safeMedia}" alt="embed media" class="inline-media">`;
			}
			seenMedia.add(key);
		}
		mediaCandidates.map(mediaKey).forEach(k => seenMedia.add(k));
	}

	if (!title && !description && !fields && !footer && !author && !media) return '';

	return `<div class="embed-card">${author}${title}${description}${fields}${media}${footer}</div>`;
};

const resolveAvatar = author => {
	if (!author) return DEFAULT_AVATAR;
	if (author.avatar?.startsWith?.('http')) return author.avatar;
	if (author.userId && author.avatar) {
		return `https://cdn.discordapp.com/avatars/${author.userId}/${author.avatar}.png?size=512`;
	}
	if (author.proxyAvatar) return author.proxyAvatar;
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

const normalizeHex = input => {
	if (!input) return null;
	const hex = input.replace('#', '');
	if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
	if (/^[0-9a-fA-F]{3}$/.test(hex)) {
		const expanded = hex.split('').map(c => c + c).join('');
		return `#${expanded.toLowerCase()}`;
	}
	return null;
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
		const roleName = message.author?.role?.name;
		const roleColor = normalizeHex(message.author?.role?.colour);
		const content = message.text ?? '';
		const seenMedia = new Set();

		let contentHtml = linkifyWithSeen(content, seenMedia)
			.replace(/\n/g, '<br>')
			.replace(/\t/g, '&nbsp;&nbsp;');
		contentHtml = contentHtml
			.replace(/^(<br>|&nbsp;|\s)+/gi, '')
			.replace(/(<br>\s*)+$/gi, '')
			.replace(/(<br>\s*){2,}/gi, '<br>');

		const attachmentBlocks = (message.content?.attachments || [])
			.map(att => {
				const primary = att.proxy_url || att.url;
				const safe = escapeHtml(primary || '');
				if (!safe) return '';
				const key = mediaKey(primary);
				if (seenMedia.has(key)) return '';
				seenMedia.add(key);
				if (att.url) seenMedia.add(mediaKey(att.url));
				const contentType = att.content_type || '';
				const isImg = isImageUrl(primary) || contentType.startsWith('image/');
				const isVid = isVideoUrl(primary) || contentType.startsWith('video/');
				if (isImg) return `<img src="${safe}" alt="attachment" class="inline-media">`;
				if (isVid) return `<video src="${safe}" class="inline-media video-media" autoplay loop muted playsinline controls></video>`;
				return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
			})
			.filter(Boolean);

		const embedsRaw = (() => {
			if (Array.isArray(message.content?.embeds)) return message.content.embeds;
			if (message.content?.embeds) return [message.content.embeds];
			return [];
		})();

		let embedCards = embedsRaw
			.map(embed => renderEmbed(embed, seenMedia))
			.filter(Boolean);
		if (!embedCards.length && embedsRaw.length > 0) {
			embedCards = [`<div class="embed-card muted">[embed]</div>`];
		}

		const hasEmbeds = embedsRaw.length > 0;
		const hasAttachments = attachmentBlocks.length > 0;
		const hasText = content && content.trim().length > 0;

		if (!hasText && !hasEmbeds && !hasAttachments) {
			contentHtml = '<span class="muted">[no content, likely embedded message]</span>';
		} else {
			contentHtml ||= '';
			if (hasAttachments) contentHtml += `<div class="embed-media">${attachmentBlocks.join('')}</div>`;
			if (hasEmbeds) contentHtml += `<div class="embed-media">${embedCards.join('')}</div>`;
		}

		return {
			avatar: escapeHtml(resolveAvatar(message.author)),
			author: escapeHtml(authorName),
			authorHtml: (() => {
				const nameStyle = roleColor ? ` style="color:${roleColor}"` : '';
				const name = `<span class="author-name"${nameStyle}>${escapeHtml(authorName)}</span>`;
				const role = roleName
					? `<span class="role-pill" style="border-color:${roleColor || 'var(--border)'};color:${roleColor || 'var(--muted)'};">${escapeHtml(roleName)}</span>`
					: '';
				const copy = message.authorId
					? `<button type="button" class="copy-id-pill" data-user-id="${escapeHtml(message.authorId)}" title="Copy user ID">\u29C1 ${escapeHtml(message.authorId)}</button>`
					: '';
				return [name, role, copy].filter(Boolean).join('');
			})(),
			authorId: escapeHtml(message.authorId || ''),
			contentHtml,
			number: message.number,
			timestamp: short.format(message.createdAt),
			edited: Boolean(message.edited),
			deleted: Boolean(message.deleted),
			editedLabel: 'Edited',
			deletedLabel: 'Deleted',
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
