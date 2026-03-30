const { SlashCommand } = require('@eartharoid/dbf');
const { MessageFlags } = require('discord.js');

const formatRating = value => {
	const v = Number(value) || 0;
	const fixed = v.toFixed(1);
	return fixed.endsWith('.0') ? String(Math.round(v)) : fixed;
};

module.exports = class RatingSlashCommand extends SlashCommand {
	constructor(client, options) {
		super(client, {
			...options,
			description: 'Show average bot rating',
			dmPermission: false,
			name: 'rating',
		});
	}

	async run(interaction) {
		const client = this.client;
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const aggregate = await client.prisma.feedback.aggregate({
			_sum: { rating: true },
			_count: { _all: true },
		});
		const count = aggregate._count?._all || 0;
		const avg = count ? (aggregate._sum.rating || 0) / count : 0;

		const ratingText = `${formatRating(avg)}/5`;

		await interaction.editReply({
			content: `Current average rating: **${ratingText}** (${count} rating${count === 1 ? '' : 's'})\nView details: ${process.env.HTTP_EXTERNAL || ''}/rating`,
		});
	}
};
