const { SlashCommand } = require('@eartharoid/dbf');
const { isStaff } = require('../../lib/users');
const ExtendedEmbedBuilder = require('../../lib/embed');
const { version } = require('../../../package.json');
const { MessageFlags } = require('discord.js');

module.exports = class ClaimSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'help';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
		});
	}

	
	async run(interaction) {
		
		const client = this.client;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const staff = await isStaff(interaction.guild, interaction.member.id);
		const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
		const getMessage = client.i18n.getLocale(settings.locale);
		const commandLines = client.application.commands.cache
			.filter(c => c.type === 1)
			.map(c => `> </${c.name}:${c.id}>: ${c.description}`);
		const maxLen = 900;
		const trimmed = [];
		let used = 0;
		for (const line of commandLines) {
			if (used + line.length + 1 > maxLen) break;
			trimmed.push(line);
			used += line.length + 1;
		}
		const overflow = commandLines.length - trimmed.length;
		const commands = trimmed.join('\n') + (overflow > 0 ? `\n> …${overflow} more` : '');
		const newCommand = client.application.commands.cache.find(c => c.name === 'new');
		const fields = [
			{
				name: getMessage('commands.slash.help.response.commands'),
				value: commands,
			},
		];

		if (staff) {
			fields.unshift(
				{
					inline: true,
					name: getMessage('commands.slash.help.response.links.links'),
					value: [
						['commands', 'https://discordtickets.app/features/commands'],
						['docs', 'https://discordtickets.app'],
						['feedback', 'https://lnk.earth/dsctickets-feedback'],
						['support', 'https://lnk.earth/discord'],
					]
						.map(([l, url]) => `> [${getMessage('commands.slash.help.response.links.' + l)}](${url})`)
						.join('\n'),
				},
				{
					inline: true,
					name: getMessage('commands.slash.help.response.settings'),
					value: '> ' + process.env.HTTP_EXTERNAL + '/settings',
				},
			);
		}

		interaction.editReply({
			embeds: [
				new ExtendedEmbedBuilder({
					iconURL: interaction.guild.iconURL(),
					text: settings.footer,
				})
					.setColor(settings.primaryColour)
					.setTitle(getMessage('commands.slash.help.title'))
					.setDescription(staff
						? `**Ezz Tickets v${version} by Ezz.**`
						: getMessage('commands.slash.help.response.description', { command: `</${newCommand.name}:${newCommand.id}>` }))
					.setFields(fields),
			],
		});
	}
};

