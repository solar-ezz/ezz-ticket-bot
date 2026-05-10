const { SlashCommand } = require('@eartharoid/dbf');
const { PermissionsBitField, AttachmentBuilder } = require('discord.js');
const { MessageFlags } = require('discord.js');

const CONSOLE_ROLE_ID = '1488215073460850740';

module.exports = class ConsoleSlashCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			name: 'console',
			description: 'View recent console output.',
			dmPermission: false,
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
		});
	}

	async run(interaction) {
		if (!interaction.member.roles.has(CONSOLE_ROLE_ID)) {
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
