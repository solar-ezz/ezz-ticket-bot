const { SlashCommand } = require('@eartharoid/dbf');
const { EmbedBuilder } = require('discord.js');

const formatRating = value => {
	const v = Number(value) || 0;
	const fixed = v.toFixed(1);
	return fixed.endsWith('.0') ? String(Math.round(v)) : fixed;
};

const getStars = rating => {
	const full = Math.floor(rating);
	const half = rating % 1 >= 0.5 ? 1 : 0;
	const empty = 5 - full - half;
	return '⭐'.repeat(full) + (half ? '✨' : '') + '☆'.repeat(empty);
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

		await interaction.deferReply();

		const aggregate = await client.prisma.feedback.aggregate({
			_sum: { rating: true },
			_count: { _all: true },
		});

		const count = aggregate._count?._all || 0;
		const avg = count ? (aggregate._sum.rating || 0) / count : 0;

		const ratingText = `${formatRating(avg)}/5`;
		const stars = getStars(avg);

		const embed = new EmbedBuilder()
			.setTitle('⭐ Bot Rating')
			.setDescription(`**${ratingText}**\n${stars}`)
			.addFields(
				{ name: 'Total Ratings', value: `${count}`, inline: true },
				{ name: 'Details', value: `${process.env.HTTP_EXTERNAL || ''}/rating`, inline: true }
			)
			.setColor(0x9b59b6)
			.setFooter({ text: 'Thanks for your feedback!' })
			.setTimestamp();

		await interaction.editReply({
			embeds: [embed],
		});
	}
};
