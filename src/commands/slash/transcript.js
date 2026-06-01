const { SlashCommand } = require('@eartharoid/dbf');
const {
	ApplicationCommandOptionType,
	PermissionsBitField,
	MessageFlags,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const { AttachmentBuilder } = require('discord.js');
const ExtendedEmbedBuilder = require('../../lib/embed');
const {
	buildTranscriptViewModel,
	createTranscriptUrls,
	ensureMarkdownBackup,
	fetchTranscriptTicket,
	renderMarkdown,
} = require('../../lib/transcript');

module.exports = class TranscriptSlashCommand extends SlashCommand {
	constructor(client, options) {
		const name = 'transcript';
		super(client, {
			...options,
			description: client.i18n.getMessage(null, `commands.slash.${name}.description`),
			descriptionLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.description`),
			dmPermission: false,
			name,
			nameLocalizations: client.i18n.getAllMessages(`commands.slash.${name}.name`),
			options: [
				{
					autocomplete: true,
					name: 'ticket',
					required: true,
					type: ApplicationCommandOptionType.String,
				},
				{
					name: 'member',
					required: false,
					type: ApplicationCommandOptionType.User,
				},
			].map(option => {
				option.descriptionLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.description`);
				option.description = option.descriptionLocalizations['en-GB'];
				option.nameLocalizations = client.i18n.getAllMessages(`commands.slash.${name}.options.${option.name}.name`);
				return option;
			}),
		});
	}

	shouldAllowAccess(interaction, ticket) {
		
		if (ticket.createdById === interaction.user.id) return true; 
		
		if (interaction.guild?.id !== ticket.guildId) return false;
		
		if (interaction.client.supers.includes(interaction.member.id)) return true;
		if (interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;
		if (interaction.member.roles.cache.filter(role => ticket.category.staffRoles.includes(role.id)).size > 0) return true;
		return false;
	}

	
	async run(interaction, ticketId) {
		
		const client = this.client;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		ticketId = ticketId || interaction.options.getString('ticket', true);
		const ticket = await fetchTranscriptTicket(client, ticketId, interaction.guildId);

		if (!ticket) throw new Error(`Ticket ${ticketId} does not exist`);

		if (!this.shouldAllowAccess(interaction, ticket)) {
			const settings = await client.prisma.guild.findUnique({ where: { id: interaction.guild.id } });
			const getMessage = client.i18n.getLocale(settings.locale);
			return await interaction.editReply({
				embeds: [
					new ExtendedEmbedBuilder({
						iconURL: interaction.guild.iconURL(),
						text: ticket.guild.footer,
					})
						.setColor(ticket.guild.errorColour)
						.setTitle(getMessage('commands.slash.transcript.not_staff.title'))
						.setDescription(getMessage('commands.slash.transcript.not_staff.description')),
				],
			});
		}

		const viewModel = await buildTranscriptViewModel(client, ticket);
		const { token, viewUrl, downloadUrl } = await createTranscriptUrls(client, ticket.id);
		viewModel.transcriptUrl = viewUrl;
		viewModel.downloadUrl = downloadUrl;

		const transcript = renderMarkdown(client, viewModel);
		await ensureMarkdownBackup(viewModel.mdFileName, transcript);
		const attachment = new AttachmentBuilder()
			.setFile(Buffer.from(transcript))
			.setName(viewModel.mdFileName);

		const getMessage = client.i18n.getLocale(ticket.guild.locale);
		const resolveGuildEmoji = async (name, fallback) => {
			const EMOJI_SOURCE_GUILD = '1376192215029649409';
			const sourceGuild = client.guilds.cache.get(EMOJI_SOURCE_GUILD);
			let found = sourceGuild?.emojis?.cache?.find(e => e.name === name);
			if (!found && sourceGuild?.emojis?.fetch) {
				try {
					await sourceGuild.emojis.fetch();
					found = sourceGuild.emojis.cache.find(e => e.name === name);
				} catch {}
			}
			if (found) return found || fallback;
			const guild = client.guilds.cache.get(ticket.guildId || ticket.guild.id);
			found = guild?.emojis?.cache?.find(e => e.name === name);
			if (!found && guild?.emojis?.fetch) {
				try {
					await guild.emojis.fetch();
					found = guild.emojis.cache.find(e => e.name === name);
				} catch {}
			}
			return found || fallback;
		};
		const successTitle = getMessage('commands.slash.transcript.success.title') || 'Transcript available';
		const successDescription = getMessage('commands.slash.transcript.success.description', { url: viewUrl }) || 'Open the transcript online or download the Markdown backup.';
		const components = [
			new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setEmoji(await resolveGuildEmoji('ezz_transcript', client.i18n.getMessage(ticket.guild.locale, 'buttons.transcript.emoji')))
						.setLabel(getMessage('buttons.transcript.text'))
						.setStyle(ButtonStyle.Link)
						.setURL(viewUrl),
					new ButtonBuilder()
						.setLabel('Download .md')
						.setStyle(ButtonStyle.Link)
						.setURL(downloadUrl),
				),
		];

		const embed = new ExtendedEmbedBuilder({
			iconURL: interaction.guild?.iconURL(),
			text: ticket.guild.footer,
		})
			.setColor(ticket.guild.primaryColour)
			.setTitle(successTitle)
			.setDescription(successDescription);

		await interaction.editReply({
			components,
			embeds: [embed],
			files: [attachment],
		});
	}
};

