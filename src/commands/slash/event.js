const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	ChannelType,
	MessageFlags,
} = require('discord.js');
const { getPrivilegeLevel } = require('../../lib/users');
const {
	MAX_TEAM_SIZE,
	buildPanel,
	canManageEvents,
	getEventCategory,
	getEventSettings,
	reply,
	saveEventSettings,
} = require('../../lib/events');

const roleOption = (name, description) => ({
	description,
	name,
	options: [
		{
			description: 'The role',
			name: 'role',
			required: true,
			type: ApplicationCommandOptionType.Role,
		},
	],
	type: ApplicationCommandOptionType.Subcommand,
});

module.exports = class EventSlashCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			description: 'Run events: post sign-up panels and configure events',
			dmPermission: false,
			name: 'event',
			options: [
				{
					description: 'Post an event sign-up panel in this channel',
					name: 'panel',
					options: [
						{
							description: 'Event title shown on the panel',
							maxLength: 100,
							name: 'title',
							required: true,
							type: ApplicationCommandOptionType.String,
						},
						{
							description: 'Panel description (use \\n for new lines)',
							maxLength: 2000,
							name: 'description',
							required: false,
							type: ApplicationCommandOptionType.String,
						},
						{
							description: `Maximum players per team, including the creator (default 4, max ${MAX_TEAM_SIZE})`,
							maxValue: MAX_TEAM_SIZE,
							minValue: 1,
							name: 'team-size',
							required: false,
							type: ApplicationCommandOptionType.Integer,
						},
						{
							description: 'Short name used in channel names, e.g. "puzzles" (defaults to the title)',
							maxLength: 28,
							name: 'short-name',
							required: false,
							type: ApplicationCommandOptionType.String,
						},
						{
							description: 'Image URL shown on the panel',
							name: 'image',
							required: false,
							type: ApplicationCommandOptionType.String,
						},
						{
							description: 'Button text (default "Join event")',
							maxLength: 80,
							name: 'button-label',
							required: false,
							type: ApplicationCommandOptionType.String,
						},
						{
							description: 'Button emoji (unicode or custom emoji)',
							name: 'button-emoji',
							required: false,
							type: ApplicationCommandOptionType.String,
						},
						{
							description: 'Role to ping with the panel',
							name: 'ping',
							required: false,
							type: ApplicationCommandOptionType.Role,
						},
					],
					type: ApplicationCommandOptionType.Subcommand,
				},
				{
					description: 'Set where event tickets are created and which staff can see them',
					name: 'setup',
					options: [
						{
							channelTypes: [ChannelType.GuildCategory],
							description: 'Discord category that event tickets are created in',
							name: 'category',
							required: true,
							type: ApplicationCommandOptionType.Channel,
						},
						{
							description: 'Staff role that can see event tickets',
							name: 'staff-role',
							required: false,
							type: ApplicationCommandOptionType.Role,
						},
						{
							description: 'Role to ping when a team signs up',
							name: 'ping-role',
							required: false,
							type: ApplicationCommandOptionType.Role,
						},
					],
					type: ApplicationCommandOptionType.Subcommand,
				},
				{
					description: 'Manage which roles can post event panels',
					name: 'roles',
					options: [
						roleOption('add', 'Allow a role to post event panels'),
						roleOption('remove', 'Stop a role from posting event panels'),
						{
							description: 'Show the event setup and event manager roles',
							name: 'list',
							type: ApplicationCommandOptionType.Subcommand,
						},
					],
					type: ApplicationCommandOptionType.SubcommandGroup,
				},
			],
		});
	}

	async run(interaction) {
		const settings = await getEventSettings(this.client, interaction.guild.id);
		if (!settings) {
			return await reply(interaction, null, {
				colour: 'Red',
				description: 'This server has not been set up yet.',
				title: '❌ Not set up',
			});
		}

		const group = interaction.options.getSubcommandGroup(false);
		const sub = interaction.options.getSubcommand();

		if (sub === 'panel') return await this.panel(interaction, settings);
		if (group === 'roles' && sub === 'list') return await this.list(interaction, settings);

		if (await getPrivilegeLevel(interaction.member) < 2) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: 'Only server admins can change event settings.',
				title: '❌ Missing permissions',
			});
		}

		if (sub === 'setup') return await this.setup(interaction, settings);
		if (group === 'roles') return await this.roles(interaction, settings, sub);
	}

	dashboardUrl(guildId) {
		return `${process.env.HTTP_EXTERNAL}/settings/${guildId}/events`;
	}

	async panel(interaction, settings) {
		const client = this.client;
		if (!(await canManageEvents(interaction.member, settings))) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: 'You need an event manager role to post event panels.',
				title: '❌ Missing permissions',
			});
		}

		const category = await getEventCategory(client, interaction.guild.id);
		if (!category || !interaction.guild.channels.cache.has(category.discordCategory)) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: `Events aren't set up yet. An admin needs to run \`/event setup\` or use the [Events page](${this.dashboardUrl(interaction.guild.id)}).`,
				title: '❌ Events not set up',
			});
		}

		const image = interaction.options.getString('image', false);
		if (image && !/^https?:\/\/\S+$/i.test(image)) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: 'The image must be a valid http(s) URL.',
				title: '❌ Invalid image',
			});
		}

		const ping = interaction.options.getRole('ping', false);
		const panel = buildPanel({
			buttonEmoji: interaction.options.getString('button-emoji', false),
			buttonLabel: interaction.options.getString('button-label', false),
			category,
			colour: settings.primaryColour,
			description: interaction.options.getString('description', false),
			footer: settings.footer,
			guild: interaction.guild,
			image,
			name: interaction.options.getString('short-name', false),
			teamSize: interaction.options.getInteger('team-size', false) ?? 4,
			title: interaction.options.getString('title', true),
		});

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			await interaction.channel.send({
				...panel,
				allowedMentions: ping ? { roles: [ping.id] } : { parse: [] },
				content: ping ? ping.toString() : undefined,
			});
		} catch (error) {
			client.log.error(error);
			return await interaction.editReply({ content: '❌ I could not send the panel here. Check that I can view this channel, send messages and embed links.' });
		}

		await interaction.editReply({ content: '✅ Event panel posted. Anyone can sign up with the button.' });
	}

	async setup(interaction, settings) {
		const discordCategory = interaction.options.getChannel('category', true);
		const staffRole = interaction.options.getRole('staff-role', false);
		const pingRole = interaction.options.getRole('ping-role', false);
		const input = { discordCategory: discordCategory.id };
		if (staffRole) input.staffRoles = [staffRole.id];
		if (pingRole) input.pingRoles = [pingRole.id];

		await saveEventSettings(this.client, interaction.guild, input);

		return await reply(interaction, settings, {
			colour: settings.successColour,
			description: [
				`Event tickets will be created in **${discordCategory.name}**.`,
				staffRole ? `${staffRole} can see event tickets.` : null,
				pingRole ? `${pingRole} is pinged when a team signs up.` : null,
				'',
				`Post a panel with \`/event panel\`. More options (opening message, channel names, questions) are on the [Events page](${this.dashboardUrl(interaction.guild.id)}).`,
			].filter(line => line !== null).join('\n'),
			title: '✅ Events set up',
		});
	}

	async list(interaction, settings) {
		const category = await getEventCategory(this.client, interaction.guild.id);
		const roles = settings.eventManagerRoles;
		return await reply(interaction, settings, {
			description: [
				'**Event tickets category**',
				category ? `<#${category.discordCategory}>` : 'Not set up. Run `/event setup`.',
				'',
				'**Event staff**',
				category?.staffRoles?.length ? category.staffRoles.map(r => `<@&${r}>`).join(' ') : 'None',
				'',
				'**Can post panels**',
				roles.length ? roles.map(r => `<@&${r}>`).join(' ') : 'Admins and any role named "Event Manager"',
			].join('\n'),
			title: '🎉 Event settings',
		});
	}

	async roles(interaction, settings, sub) {
		let roles = [...settings.eventManagerRoles];
		const role = interaction.options.getRole('role', true);
		if (sub === 'add') {
			if (!roles.includes(role.id)) roles.push(role.id);
		} else {
			roles = roles.filter(r => r !== role.id);
		}

		await this.client.prisma.guild.update({
			data: { eventManagerRoles: roles },
			where: { id: interaction.guild.id },
		});

		return await reply(interaction, settings, {
			colour: settings.successColour,
			description: sub === 'add'
				? `${role} can now post event panels with \`/event panel\`.`
				: `${role} can no longer post event panels.`,
			title: '✅ Event roles updated',
		});
	}
};
