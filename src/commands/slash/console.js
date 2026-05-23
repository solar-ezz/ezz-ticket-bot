const { SlashCommand } = require('@eartharoid/dbf');
const { PermissionsBitField, AttachmentBuilder } = require('discord.js');
const { MessageFlags } = require('discord.js');

const CONSOLE_ROLE_ID = '1488215073460850740';

module.exports = class ConsoleSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'console';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
		});
	}

	async run(interaction) {
		const roles = interaction.member.roles;
		const hasRole = roles.cache ? roles.cache.has(CONSOLE_ROLE_ID) : roles.includes && roles.includes(CONSOLE_ROLE_ID);
		if (!hasRole) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const logs = this.client.consoleLogs || [];

		if (logs.length === 0) {
			return interaction.editReply({
				content: 'No console logs available.',
			});
		}

		const content = logs.join('\n');
		const buffer = Buffer.from(content, 'utf-8');
		const attachment = new AttachmentBuilder(buffer, { name: 'console.txt' });

		await interaction.editReply({
			files: [attachment],
		});
	}
};
