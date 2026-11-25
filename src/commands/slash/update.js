const { SlashCommand } = require('@eartharoid/dbf');
const {
	PermissionsBitField, EmbedBuilder, MessageFlags,
} = require('discord.js');
const { execSync } = require('child_process');
const {
	existsSync, mkdirSync, readFileSync, writeFileSync,
} = require('fs');
const {
	dirname, join, resolve,
} = require('path');

const ROOT = resolve(__dirname, '../../..');
const REPOSITORY = process.env.UPDATE_REPOSITORY || 'https://github.com/solar-ezz/ezz-ticket-bot.git';
const BRANCH = process.env.UPDATE_BRANCH || 'main';
const PRESERVE = [
	'src/user/config.yml',
	'src/user/banned-guilds.txt',
	'src/user/templates/transcript.md.mustache',
];

const run = (command, timeout = 60000) => execSync(command, {
	cwd: ROOT,
	encoding: 'utf8',
	env: process.env,
	stdio: ['ignore', 'pipe', 'pipe'],
	timeout,
}).trim();

const git = args => run(`git -c safe.directory="${ROOT.replace(/\\/g, '/')}" ${args}`);

const embed = (colour, title, description) => new EmbedBuilder()
	.setColor(colour)
	.setTitle(title)
	.setDescription(description);

const backup = () => PRESERVE
	.map(file => join(ROOT, file))
	.filter(path => existsSync(path))
	.map(path => ({
		data: readFileSync(path),
		path,
	}));

const restore = files => {
	for (const file of files) {
		mkdirSync(dirname(file.path), { recursive: true });
		writeFileSync(file.path, file.data);
	}
};

const readVersion = () => {
	try {
		return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
	} catch {
		return 'unknown';
	}
};

const restart = () => {
	try {
		execSync(`pm2 restart ${process.env.PM2_NAME || 'ezz-ticket-bot'}`, {
			stdio: 'ignore',
			timeout: 15000,
		});
	} catch {
		process.exit(1);
	}
};

module.exports = class UpdateCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
			description: 'Pull the latest code from GitHub and restart the bot.',
			dmPermission: false,
			name: 'update',
		});
	}

	async run(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const currentVersion = readVersion();

		try {
			try {
				git('--version');
			} catch {
				throw new Error('Git is not installed on the server, so the bot cannot update itself.');
			}

			let fresh = false;
			if (!existsSync(join(ROOT, '.git'))) {
				fresh = true;
				git('init');
				git(`remote add origin ${REPOSITORY}`);
			} else {
				const remotes = git('remote').split('\n');
				if (!remotes.includes('origin')) git(`remote add origin ${REPOSITORY}`);
			}

			git(`fetch origin ${BRANCH}`);

			const behind = fresh ? null : parseInt(git(`rev-list HEAD..origin/${BRANCH} --count`), 10);
			if (behind === 0) {
				return interaction.editReply({ embeds: [embed(0x2ecc71, 'Already up to date', `Running v${currentVersion}. No updates available.`)] });
			}

			let commits = '';
			if (!fresh) {
				const log = git(`log --oneline HEAD..origin/${BRANCH} --no-decorate`);
				commits = log.split('\n').slice(0, 10).map(c => `• ${c}`).join('\n') + (behind > 10 ? `\n… and ${behind - 10} more` : '');
			}

			await interaction.editReply({
				embeds: [
					embed(
						0xe67e22,
						'Pulling updates…',
						fresh
							? 'This install was not linked to GitHub yet. Linking it and downloading the latest code…'
							: `**${behind}** new commit(s) found. Applying now…`,
					).addFields(commits ? [{
						name: 'Incoming commits',
						value: commits.slice(0, 1024),
					}] : []),
				],
			});

			const saved = backup();
			try {
				git(`reset --hard origin/${BRANCH}`);
				if (fresh) {
					git(`checkout -B ${BRANCH} --track origin/${BRANCH}`);
					for (const branch of git('branch --format=%(refname:short)').split('\n')) {
						if (branch && branch !== BRANCH) git(`branch -D ${branch}`);
					}
				}
			} finally {
				restore(saved);
			}

			run('npm install --omit=dev --no-audit --no-fund', 300000);

			const newVersion = readVersion();
			await interaction.editReply({
				embeds: [
					embed(
						0x2ecc71,
						'Update complete',
						`${fresh ? 'Linked to GitHub and updated to the latest code.' : `Pulled **${behind}** commit(s).`}\n\`${currentVersion}\` → \`${newVersion}\`\n\nRestarting now…`,
					),
				],
			});

			setTimeout(restart, 1500);
		} catch (error) {
			const details = String(error.stderr || error.message || error).trim().slice(0, 1800);
			return interaction.editReply({ embeds: [embed(0xe74c3c, 'Update failed', `\`\`\`\n${details}\n\`\`\``)] });
		}
	}
};
