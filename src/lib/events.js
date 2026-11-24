const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');
const emoji = require('node-emoji');
const ExtendedEmbedBuilder = require('./embed');
const { getPrivilegeLevel } = require('./users');

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
			t: category.id,
		}))
		.setStyle(ButtonStyle.Primary)
		.setLabel(buttonLabel || 'Join event');
	const parsed = parseEmoji(buttonEmoji) ?? parseEmoji(category.emoji);
	if (parsed) button.setEmoji(parsed);

	return {
		components: [new ActionRowBuilder().setComponents(button)],
		embeds: [embed],
	};
};

module.exports = {
	MAX_TEAM_SIZE,
	buildChannelName,
	buildPanel,
	canManageEvents,
	getEventSettings,
	reply,
	slugify,
	teamSlug,
};
