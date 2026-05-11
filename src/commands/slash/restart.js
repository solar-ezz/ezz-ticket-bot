const { SlashCommand } = require('@eartharoid/dbf');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { spawn } = require('child_process');
const { writeFile, readFile, unlink, mkdir } = require('fs/promises');
const { join } = require('path');
const { version } = require('../../../package.json');

const RESTART_FILE = join(process.cwd(), 'tmp', '.restart-state.json');

module.exports = class RestartSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'restart';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
			options: [
				{
					type: 5,
					name: 'update',
					description: client.i18n.getMessage(null, `commands.slash.${name}.options.update.description`),
					required: false,
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.nameLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.name`);
				return option;
			}),
		});
	}

	async run(interaction) {
		const shouldUpdate = interaction.options.getBoolean('update') ?? false;
		const versionBefore = version;

		const embed = new EmbedBuilder()
			.setTitle('🔄 Bot Restarting')
			.setDescription('The bot is being restarted. This may take a moment.')
			.setColor(0x3498db)
			.setFooter({ text: 'Please wait...' })
			.setTimestamp();

		await interaction.reply({
			embeds: [embed],
		});

		const restartState = {
			channelId: interaction.channelId,
			guildId: interaction.guildId,
			userId: interaction.user.id,
			versionBefore,
			shouldUpdate,
			timestamp: Date.now(),
		};

		try {
			const tmpDir = join(process.cwd(), 'tmp');
			await mkdir(tmpDir, { recursive: true });
			await writeFile(RESTART_FILE, JSON.stringify(restartState), { flag: 'w' });
		} catch (error) {
			this.client.log.error(error);
		}

		const args = shouldUpdate ? ['run', 'start'] : ['start'];
		const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

		if (shouldUpdate) {
			spawn(npmCommand, ['install'], { detached: true, stdio: 'ignore' });
		}

		setTimeout(() => {
			spawn(npmCommand, args, { detached: true, stdio: 'ignore' });
			process.exit(0);
		}, 1000);
	}

	static async sendRestartOverview(client) {
		try {
			const data = await readFile(RESTART_FILE, 'utf8');
			const state = JSON.parse(data);

			const guild = await client.guilds.fetch(state.guildId).catch(() => null);
			if (!guild) {
				client.log.warn('Could not fetch guild for restart overview');
				return;
			}

			const channel = await guild.channels.fetch(state.channelId).catch(() => null);
			if (!channel || !channel.isSendable?.()) {
				client.log.warn('Could not fetch channel or channel not sendable for restart overview');
				return;
			}

			const user = await client.users.fetch(state.userId).catch(() => null);
			const userName = user ? user.username : 'Unknown User';

			const duration = Date.now() - state.timestamp;
			const seconds = Math.round(duration / 1000);

			const embed = new EmbedBuilder()
				.setTitle('✅ Bot Restarted')
				.setDescription(`Restart completed in ${seconds}s`)
				.addFields(
					{ name: 'Version', value: `${state.versionBefore} → ${version}`, inline: true },
					{ name: 'Updated', value: state.shouldUpdate ? 'Yes' : 'No', inline: true },
					{ name: 'Initiated by', value: userName, inline: true },
				)
				.setColor(0x2ecc71)
				.setTimestamp();

			await channel.send({
				embeds: [embed],
			});

			await unlink(RESTART_FILE).catch(() => null);
		} catch (error) {
			if (error.code !== 'ENOENT') {
				client.log.warn('Error sending restart overview:', error);
			}
		}
	}
};
