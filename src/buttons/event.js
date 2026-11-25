const { Button } = require('@eartharoid/dbf');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	MessageFlags,
	UserSelectMenuBuilder,
} = require('discord.js');
const ExtendedEmbedBuilder = require('../lib/embed');
const {
	MAX_TEAM_SIZE,
	findEventSignup,
	getEventCategory,
	reply,
} = require('../lib/events');
const ms = require('ms');

module.exports = class EventButton extends Button {
	constructor(client, options) {
		super(client, {
			...options,
			id: 'event',
		});
	}

	async run(id, interaction) {
		const client = this.client;
		const teamSize = Math.min(Math.max(Number(id.s) || 1, 1), MAX_TEAM_SIZE);
		const title = interaction.message?.embeds?.[0]?.title || id.n || 'Event';
		const event = {
			slug: id.n || title,
			title,
		};

		const eventCategory = await getEventCategory(client, interaction.guild.id);
		const category = eventCategory ? await client.tickets.getCategory(eventCategory.id) : null;
		if (!category) {
			return await reply(interaction, null, {
				colour: 'Red',
				description: 'Event sign-ups are not set up on this server yet. Ask an admin to run `/event setup`.',
				title: '❌ Events not set up',
			});
		}
		const categoryId = category.id;
		const settings = category.guild;

		const existing = await findEventSignup(client, interaction.guild, categoryId, title, [interaction.user.id]);
		if (existing) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: `You're already signed up for **${title}** in <#${existing.channelId}>.`,
				title: '❌ Already signed up',
			});
		}

		if (teamSize <= 1) {
			return await client.tickets.create({
				categoryId,
				event: {
					...event,
					teammates: [],
				},
				interaction,
			});
		}

		const max = teamSize - 1;
		const nonce = interaction.id;
		const picker = new UserSelectMenuBuilder()
			.setCustomId(JSON.stringify({
				action: '_event_team',
				n: nonce,
			}))
			.setPlaceholder(`Select up to ${max} teammate${max === 1 ? '' : 's'}`)
			.setMinValues(1)
			.setMaxValues(max);
		const solo = new ButtonBuilder()
			.setCustomId(JSON.stringify({
				action: '_event_solo',
				n: nonce,
			}))
			.setStyle(ButtonStyle.Secondary)
			.setEmoji('👤')
			.setLabel('Play solo');

		const response = await interaction.reply({
			components: [
				new ActionRowBuilder().setComponents(picker),
				new ActionRowBuilder().setComponents(solo),
			],
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.primaryColour)
					.setTitle(`🎉 ${title}`)
					.setDescription([
						`Who are you playing with? Pick up to **${max}** teammate${max === 1 ? '' : 's'} below, or play solo.`,
						'',
						'Your teammates will be added to the ticket automatically.',
					].join('\n')),
			],
			flags: MessageFlags.Ephemeral,
			withResponse: true,
		});
		const message = response.resource?.message;
		if (!message) return;

		const collector = message.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id && i.customId.includes(nonce),
			time: ms('5m'),
		});

		collector.on('collect', async i => {
			try {
				let teammates = [];
				if (i.componentType === ComponentType.UserSelect) {
					const check = await this.validateTeam(i, category, settings, title);
					if (!check.ok) {
						return await reply(i, settings, {
							colour: settings.errorColour,
							description: check.message,
							title: '❌ Can\'t create that team',
						});
					}
					teammates = check.ids;
				}
				collector.stop('done');
				await client.tickets.create({
					categoryId,
					event: {
						...event,
						teammates,
					},
					interaction: i,
				});
				interaction.editReply({ components: [] }).catch(() => {});
			} catch (error) {
				client.log.error.tickets(error);
			}
		});

		collector.on('end', (_, reason) => {
			if (reason !== 'done') interaction.editReply({ components: [] }).catch(() => {});
		});
	}

	async validateTeam(interaction, category, settings, title) {
		const client = this.client;
		const guild = interaction.guild;
		const ids = [...new Set(interaction.values)];

		if (ids.includes(interaction.user.id)) {
			return {
				message: 'You don\'t need to pick yourself, you are already on the team.',
				ok: false,
			};
		}

		const members = [];
		for (const userId of ids) {
			const member = await guild.members.fetch(userId).catch(() => null);
			if (!member) {
				return {
					message: `<@${userId}> is not in this server.`,
					ok: false,
				};
			}
			if (member.user.bot) {
				return {
					message: `${member} is a bot and can't join a team.`,
					ok: false,
				};
			}
			if (settings.blocklist?.some?.(r => member.roles.cache.has(r))) {
				return {
					message: `${member} is not allowed to join tickets.`,
					ok: false,
				};
			}
			members.push(member);
		}

		const busy = await findEventSignup(client, guild, category.id, title, members.map(m => m.id));
		if (busy) {
			return {
				message: `<@${busy.userId}> is already signed up for this event in <#${busy.channelId}>.`,
				ok: false,
			};
		}

		return {
			ids: members.map(m => m.id),
			ok: true,
		};
	}
};
