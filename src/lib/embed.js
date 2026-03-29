const { EmbedBuilder } = require('discord.js');

module.exports = class ExtendedEmbedBuilder extends EmbedBuilder {
	constructor(footer, opts) {
		super(opts);
		if (footer) {
			const text = footer.text
				?.replace(/Discord Tickets/gi, 'Ezz Tickets')
				?.replace(/eartharoid/gi, 'Ezz') || 'Ezz Tickets';
			const normalized = { ...footer, text };
			this.setFooter(normalized);
		}
	}
};
