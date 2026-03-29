const { SlashCommand } = require('@eartharoid/dbf');
const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const { join } = require('path');
const yaml = require('yaml');

module.exports = class UpdatesToggleCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			name: 'updates',
			description: 'Enable or disable update notifications.',
			dmPermission: false,
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
			options: [
				{
					type: 5,
					name: 'enabled',
					description: 'Turn update pings on or off.',
					required: true,
				},
			],
		});
	}

	async run(interaction) {
		const enabled = interaction.options.getBoolean('enabled', true);
		this.client.config.updates = enabled;
		try {
			const path = join(process.cwd(), 'user', 'config.yml');
			const raw = fs.readFileSync(path, 'utf8');
			const data = yaml.parse(raw);
			data.updates = enabled;
			fs.writeFileSync(path, yaml.stringify(data));
		} catch (error) {
			return interaction.reply({
				content: `Updated runtime flag, but failed to persist to config: ${error.message}`,
				ephemeral: true,
			});
		}

		return interaction.reply({
			content: enabled ? 'Update notifications have been enabled.' : 'Update notifications have been disabled.',
			ephemeral: true,
		});
	}
};

