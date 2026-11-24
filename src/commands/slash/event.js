const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	MessageFlags,
} = require('discord.js');
const { getPrivilegeLevel } = require('../../lib/users');
const {
	MAX_TEAM_SIZE,
	buildPanel,
	canManageEvents,
	getEventSettings,
	reply,
} = require('../../lib/events');

module.exports = class EventSlashCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			description: 'Run events: post sign-up panels and configure who can manage them',
			dmPermission: false,
			name: 'event',
			options: [
				{
					description: 'Post an event sign-up panel in this channel',
					name: 'panel',
					options: [
						{
							autocomplete: true,
							description: 'The ticket category event tickets are created in',
							name: 'category',
							required: true,
							type: ApplicationCommandOptionType.Integer,
						},
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
					description: 'Mark a ticket category as event-only (hidden from /new and normal panels)',
					name: 'category',
					options: [
						{
							autocomplete: true,
							description: 'The ticket category',
							name: 'category',
							required: true,
							type: ApplicationCommandOptionType.Integer,
						},
						{
							description: 'Only allow tickets in this category through event panels',
							name: 'event-only',
							required: true,
							type: ApplicationCommandOptionType.Boolean,
						},
					],
					type: ApplicationCommandOptionType.Subcommand,
				},
				{
					description: 'Manage which roles can run events',
					name: 'roles',
					options: [
						{
							description: 'Allow a role to post event panels',
							name: 'add',
							options: [
								{
									description: 'The role',
									name: 'role',
									required: true,
									type: ApplicationCommandOptionType.Role,
								},
							],
							type: ApplicationCommandOptionType.Subcommand,
						},
						{
							description: 'Stop a role from posting event panels',
							name: 'remove',
							options: [
								{
									description: 'The role',
									name: 'role',
									required: true,
									type: ApplicationCommandOptionType.Role,
								},
							],
							type: ApplicationCommandOptionType.Subcommand,
						},
						{
							description: 'Show the event manager roles and event categories',
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
		const client = this.client;
		const settings = await getEventSettings(client, interaction.guild.id);
		if (!settings) {
			return await reply(interaction, null, {
				colour: 'Red',
				description: 'This server has not been set up yet.',
				title: '❌ Not set up',
			});
		}

		const group = interaction.options.getSubcommandGroup(false);
		const sub = interaction.options.getSubcommand();

		if (group === null && sub === 'panel') return await this.panel(interaction, settings);

		if (await getPrivilegeLevel(interaction.member) < 2) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: 'Only server admins can change event settings.',
				title: '❌ Missing permissions',
			});
		}

		if (group === 'roles') return await this.roles(interaction, settings, sub);
		if (sub === 'category') return await this.category(interaction, settings);
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

		const categoryId = interaction.options.getInteger('category', true);
		const category = await client.prisma.category.findFirst({
			where: {
				guildId: interaction.guild.id,
				id: categoryId,
			},
		});
		if (!category) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: 'That category does not exist. Create one in the dashboard first.',
				title: '❌ Unknown category',
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

		const tip = category.eventOnly ? '' : `\nTip: run \`/event category\` to make **${category.name}** event-only so it stays out of \`/new\`.`;
		await interaction.editReply({ content: `✅ Event panel posted. Tickets will be created in **${category.name}**.${tip}` });
	}

	async roles(interaction, settings, sub) {
		const client = this.client;
		let roles = [...settings.eventManagerRoles];

		if (sub === 'list') {
			const categories = await client.prisma.category.findMany({
				select: {
					eventOnly: true,
					name: true,
				},
				where: { guildId: interaction.guild.id },
			});
			const eventCategories = categories.filter(c => c.eventOnly).map(c => `• ${c.name}`);
			return await reply(interaction, settings, {
				description: [
					'**Event manager roles**',
					roles.length ? roles.map(r => `• <@&${r}>`).join('\n') : '• None set (admins and any role named "Event Manager" can still run events)',
					'',
					'**Event-only categories**',
					eventCategories.length ? eventCategories.join('\n') : '• None',
				].join('\n'),
				title: '🎉 Event settings',
			});
		}

		const role = interaction.options.getRole('role', true);
		if (sub === 'add') {
			if (!roles.includes(role.id)) roles.push(role.id);
		} else {
			roles = roles.filter(r => r !== role.id);
		}

		await client.prisma.guild.update({
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

	async category(interaction, settings) {
		const client = this.client;
		const categoryId = interaction.options.getInteger('category', true);
		const eventOnly = interaction.options.getBoolean('event-only', true);
		const category = await client.prisma.category.findFirst({
			where: {
				guildId: interaction.guild.id,
				id: categoryId,
			},
		});
		if (!category) {
			return await reply(interaction, settings, {
				colour: settings.errorColour,
				description: 'That category does not exist.',
				title: '❌ Unknown category',
			});
		}
		await client.prisma.category.update({
			data: { eventOnly },
			where: { id: category.id },
		});
		await client.tickets.getCategory(category.id, true);
		return await reply(interaction, settings, {
			colour: settings.successColour,
			description: eventOnly
				? `**${category.name}** is now event-only. Members can only open tickets in it from event panels.`
				: `**${category.name}** is a normal ticket category again.`,
			title: '✅ Category updated',
		});
	}
};
