const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');
const emoji = require('node-emoji');
const ExtendedEmbedBuilder = require('./embed');
const {
	getPrivilegeLevel,
	updateStaffRoles,
} = require('./users');

const DEFAULT_ROLE_NAMES = ['event manager', 'event managers', 'events manager', 'event staff'];
const MAX_TEAM_SIZE = 10;

const slugify = value => String(value ?? '')
	.normalize('NFKD')
	.replace(/[̀-ͯ]/g, '')
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-+|-+$/g, '');

const teamSlug = (members, max = 70) => {
	const names = members.map(m => slugify(m.user?.username ?? m.username)).filter(Boolean);
	let out = '';
	for (const name of names) {
		const next = out ? `${out}-${name}` : name;
		if (next.length > max) break;
		out = next;
	}
	return out || names[0]?.slice(0, max) || 'team';
};

const buildChannelName = ({
	template, members, event, number,
}) => {
	const team = teamSlug(members);
	const eventSlug = slugify(event).slice(0, 28);
	let name;
	if (/{+\s?(team|event)\s?}+/i.test(template || '')) {
		const [creator] = members;
		name = template
			.replace(/{+\s?team\s?}+/gi, team)
			.replace(/{+\s?event\s?}+/gi, eventSlug)
			.replace(/{+\s?(user)?name\s?}+/gi, creator.user.username)
			.replace(/{+\s?(nick|display)(name)?\s?}+/gi, creator.displayName)
			.replace(/{+\s?num(ber)?\s?}+/gi, number);
	} else {
		name = eventSlug ? `${team}-${eventSlug}` : team;
	}
	return name.slice(0, 100);
};

const getEventSettings = async (client, guildId) => {
	const settings = await client.prisma.guild.findUnique({
		select: {
			errorColour: true,
			eventManagerRoles: true,
			footer: true,
			locale: true,
			primaryColour: true,
			successColour: true,
		},
		where: { id: guildId },
	});
	if (settings && !Array.isArray(settings.eventManagerRoles)) settings.eventManagerRoles = [];
	return settings;
};

const EVENT_DEFAULTS = {
	channelName: '{team}-{event}',
	description: 'Event sign-ups',
	emoji: '🎉',
	memberLimit: 25,
	name: 'Events',
	openingMessage: 'Welcome {username}! Your team is signed up. Event staff will be with you shortly.',
	totalLimit: 50,
};

const getEventCategory = (client, guildId) => client.prisma.category.findFirst({
	orderBy: { id: 'asc' },
	where: {
		eventOnly: true,
		guildId,
	},
});

const asArray = value => {
	if (Array.isArray(value)) return value.filter(Boolean).map(String);
	if (value === undefined || value === null || value === '') return [];
	return [String(value)];
};

const saveEventSettings = async (client, guild, input) => {
	const existing = await getEventCategory(client, guild.id);
	const data = {};
	if (input.discordCategory !== undefined) data.discordCategory = String(input.discordCategory);
	if (input.staffRoles !== undefined) data.staffRoles = asArray(input.staffRoles);
	if (input.pingRoles !== undefined) data.pingRoles = asArray(input.pingRoles);
	if (input.channelName) data.channelName = String(input.channelName).slice(0, 100);
	if (input.openingMessage) data.openingMessage = String(input.openingMessage).slice(0, 4000);
	if (input.totalLimit !== undefined && Number.isFinite(Number(input.totalLimit))) {
		data.totalLimit = Math.min(Math.max(Math.round(Number(input.totalLimit)), 1), 500);
	}

	let category;
	if (existing) {
		category = await client.prisma.category.update({
			data,
			where: { id: existing.id },
		});
	} else {
		if (!data.discordCategory) throw new Error('A Discord category is required to set up events.');
		await client.prisma.guild.upsert({
			create: { id: guild.id },
			update: {},
			where: { id: guild.id },
		});
		category = await client.prisma.category.create({
			data: {
				...EVENT_DEFAULTS,
				staffRoles: [],
				...data,
				eventOnly: true,
				guild: { connect: { id: guild.id } },
			},
		});
	}

	if (input.managerRoles !== undefined) {
		await client.prisma.guild.update({
			data: { eventManagerRoles: asArray(input.managerRoles) },
			where: { id: guild.id },
		});
	}

	await client.tickets.getCategory(category.id, true);
	await updateStaffRoles(guild);
	return category;
};

const findEventSignup = async (client, guild, categoryId, title, userIds) => {
	const open = await client.prisma.ticket.findMany({
		select: {
			createdById: true,
			id: true,
		},
		where: {
			categoryId,
			open: true,
		},
	});
	const marker = ` | ${title}`;
	for (const ticket of open) {
		const channel = guild.channels.cache.get(ticket.id);
		if (!channel?.topic?.includes(marker)) continue;
		for (const userId of userIds) {
			if (ticket.createdById === userId || channel.permissionOverwrites.cache.has(userId)) {
				return {
					channelId: ticket.id,
					userId,
				};
			}
		}
	}
	return null;
};

const canManageEvents = async (member, settings) => {
	if (await getPrivilegeLevel(member) >= 2) return true;
	const roles = settings?.eventManagerRoles ?? [];
	if (roles.some(r => member.roles.cache.has(r))) return true;
	return member.roles.cache.some(r => DEFAULT_ROLE_NAMES.includes(r.name.toLowerCase()));
};

const parseEmoji = value => {
	if (!value) return undefined;
	if (emoji.hasEmoji(value)) return emoji.get(value);
	if (/^\d{17,20}$/.test(value)) return { id: value };
	const custom = value.match(/^<a?:(\w+):(\d{17,20})>$/);
	if (custom) {
		return {
			id: custom[2],
			name: custom[1],
		};
	}
	return value;
};

const reply = (interaction, settings, {
	colour, title, description,
}) => {
	const payload = {
		embeds: [
			new ExtendedEmbedBuilder({
				iconURL: interaction.guild?.iconURL(),
				text: settings?.footer,
			})
				.setColor(colour ?? settings?.primaryColour ?? '#5865F2')
				.setTitle(title)
				.setDescription(description),
		],
		flags: MessageFlags.Ephemeral,
	};
	if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
	return interaction.reply(payload);
};

const buildPanel = ({
	category, name, title, description, teamSize, image, buttonLabel, buttonEmoji, colour, footer, guild,
}) => {
	const lines = [];
	if (description) lines.push(description.replace(/\\n/g, '\n'));
	lines.push('');
	lines.push(teamSize > 1
		? `Teams of up to **${teamSize}** players. Hit the button below and pick your teammates, or go solo.`
		: 'Hit the button below to sign up.');

	const embed = new ExtendedEmbedBuilder({
		iconURL: guild.iconURL(),
		text: footer,
	})
		.setColor(colour)
		.setTitle(title)
		.setDescription(lines.join('\n').trim());
	if (guild.iconURL()) embed.setThumbnail(guild.iconURL());
	if (image) embed.setImage(image);

	const button = new ButtonBuilder()
		.setCustomId(JSON.stringify({
			action: 'event',
			n: slugify(name || title).slice(0, 28),
			s: teamSize,
		}))
		.setStyle(ButtonStyle.Primary)
		.setLabel(buttonLabel || 'Join event');
	const parsed = parseEmoji(buttonEmoji) ?? parseEmoji(category?.emoji) ?? '🎉';
	if (parsed) button.setEmoji(parsed);

	return {
		components: [new ActionRowBuilder().setComponents(button)],
		embeds: [embed],
	};
};

module.exports = {
	EVENT_DEFAULTS,
	MAX_TEAM_SIZE,
	buildChannelName,
	buildPanel,
	canManageEvents,
	findEventSignup,
	getEventCategory,
	getEventSettings,
	reply,
	saveEventSettings,
	slugify,
	teamSlug,
};
