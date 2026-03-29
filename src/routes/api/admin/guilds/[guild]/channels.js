module.exports.get = fastify => ({
	handler: async req => {
		const { client } = req.routeOptions.config;
		const guild = client.guilds.cache.get(req.params.guild);
		if (!guild) return [];
		const fetched = await guild.channels.fetch();
		const allowedTypes = new Set([0, 5, 15, 16]); // GuildText, GuildAnnouncement, GuildForum, GuildMedia
		const channels = [...fetched.values()]
			.filter(ch => allowedTypes.has(ch.type) && !ch.isThread())
			.map(ch => ({
				id: ch.id,
				name: ch.name,
				type: ch.type,
				parentId: ch.parentId || null,
				parentName: ch.parent?.name || null,
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
		return channels;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});
