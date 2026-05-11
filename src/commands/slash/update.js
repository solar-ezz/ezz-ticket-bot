const { SlashCommand } = require('@eartharoid/dbf');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { execSync } = require('child_process');
const { version: currentVersion } = require('../../../package.json');

module.exports = class UpdateCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			name: 'update',
			description: 'Pull the latest code from GitHub and restart the bot.',
			dmPermission: false,
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
		});
	}

	async run(interaction) {
		await interaction.deferReply({ ephemeral: true });

		const cwd = process.cwd();
		const git = (args) => execSync(`git ${args}`, { cwd, encoding: 'utf8', timeout: 30000 }).trim();

		try {
			git('fetch origin');

			const behind = parseInt(git('rev-list HEAD..origin/main --count'), 10);

			if (behind === 0) {
				return interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(0x2ecc71)
							.setTitle('Already up to date')
							.setDescription(`Running v${currentVersion}. No updates available.`),
					],
				});
			}

			const log = git(`log --oneline HEAD..origin/main --no-decorate`);
			const commits = log.split('\n').slice(0, 10).map(c => `• ${c}`).join('\n');
			const more = behind > 10 ? `\n… and ${behind - 10} more` : '';

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(0xe67e22)
						.setTitle('Pulling updates…')
						.setDescription(`**${behind}** new commit(s) found. Applying now…`)
						.addFields({ name: 'Incoming commits', value: `${commits}${more}` }),
				],
			});

			git('pull origin main');

			execSync('npm install --production', { cwd, encoding: 'utf8', timeout: 120000 });

			try {
				execSync('npx prisma migrate deploy', { cwd, encoding: 'utf8', timeout: 60000, env: { ...process.env } });
			} catch {
				// migrations may not exist, that's fine
			}

			const newVersion = require('../../../package.json').version;

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(0x2ecc71)
						.setTitle('Update complete')
						.setDescription(`Pulled **${behind}** commit(s).\n\`${currentVersion}\` → \`${newVersion}\`\n\nRestarting now…`),
				],
			});

			// restart via pm2 after a short delay so the reply sends first
			setTimeout(() => {
				try {
					execSync('pm2 restart ezz-ticket-bot', { encoding: 'utf8', timeout: 15000 });
				} catch {
					// pm2 restart triggers SIGINT, this process will die
				}
			}, 1500);

		} catch (error) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(0xe74c3c)
						.setTitle('Update failed')
						.setDescription(`\`\`\`\n${error.message}\n\`\`\``),
				],
			});
		}
	}
};
