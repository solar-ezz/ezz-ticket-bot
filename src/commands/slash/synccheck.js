const { SlashCommand } = require('@eartharoid/dbf');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { mkdtemp, rm, readFile, readdir } = require('fs/promises');
const { tmpdir } = require('os');
const { join, relative } = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REMOTE = 'https:
const IGNORE_TOP = new Set(['.git', 'node_modules', 'logs', 'tmp', 'user/transcripts']);

async function execGit(args, cwd) {
	return new Promise((resolve, reject) => {
		const proc = spawn('git', args, { cwd, stdio: 'ignore' });
		proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`git ${args.join(' ')} exited with ${code}`))));
		proc.on('error', reject);
	});
}

async function walk(dir, base) {
	const entries = await readdir(dir, { withFileTypes: true });
	let files = [];
	for (const entry of entries) {
		const rel = relative(base, join(dir, entry.name)).replace(/\\/g, '/');
		if (IGNORE_TOP.has(rel.split('/')[0])) continue;
		if (entry.isDirectory()) {
			files = files.concat(await walk(join(dir, entry.name), base));
		} else if (entry.isFile()) {
			files.push(rel);
		}
	}
	return files;
}

async function hashFile(path) {
	const buf = await readFile(path);
	return crypto.createHash('md5').update(buf).digest('hex');
}

module.exports = class SyncCheckCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			name: 'synccheck',
			description: 'Compare this bot with the upstream repository (no changes applied).',
			dmPermission: false,
			defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
		});
	}

	async run(interaction) {
		await interaction.deferReply({ ephemeral: true });
		const temp = await mkdtemp(join(tmpdir(), 'ezz-sync-'));
		try {
			await execGit(['clone', '--depth', '1', REMOTE, temp]);

			const remoteFiles = await walk(temp, temp);
			const localFiles = await walk(process.cwd(), process.cwd());

			const remoteHashes = new Map(await Promise.all(remoteFiles.map(async r => [r, await hashFile(join(temp, r))])));
			const localHashes = new Map(await Promise.all(localFiles.map(async r => [r, await hashFile(join(process.cwd(), r))])));

			const added = [];
			const removed = [];
			const changed = [];

			for (const [rel, hash] of remoteHashes.entries()) {
				if (!localHashes.has(rel)) added.push(rel);
				else if (localHashes.get(rel) !== hash) changed.push(rel);
			}
			for (const rel of localHashes.keys()) {
				if (!remoteHashes.has(rel)) removed.push(rel);
			}

			const formatList = arr => {
				const max = 8;
				const head = arr.slice(0, max).map(f => `• ${f}`).join('\n');
				const more = arr.length > max ? `\n… ${arr.length - max} more` : '';
				return arr.length ? `${head}${more}` : 'None';
			};

			const embed = new EmbedBuilder()
				.setColor(0x5865f2)
				.setTitle('Sync Check')
				.setDescription(`Remote: ${REMOTE}\nAdded: ${added.length} · Removed: ${removed.length} · Changed: ${changed.length}`)
				.addFields(
					{ name: 'Changed', value: formatList(changed), inline: false },
					{ name: 'Added', value: formatList(added), inline: false },
					{ name: 'Removed', value: formatList(removed), inline: false },
				)
				.setFooter({ text: 'Compare only – no files are changed.' });

			return interaction.editReply({ embeds: [embed], ephemeral: true });
		} catch (error) {
			return interaction.editReply({ content: `Sync check failed: ${error.message}`, ephemeral: true });
		} finally {
			await rm(temp, { recursive: true, force: true }).catch(() => {});
		}
	}
};

