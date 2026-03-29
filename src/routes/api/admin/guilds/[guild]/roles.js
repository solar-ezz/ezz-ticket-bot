module.exports.get = fastify => ({
	handler: async req => {
		const { client } = req.routeOptions.config;
		const guild = client.guilds.cache.get(req.params.guild);
		if (!guild) return [];
		const roles = guild.roles.cache
			.filter(r => r.managed === false)
			.map(r => ({ id: r.id, name: r.name, position: r.position, color: r.hexColor }))
			.sort((a, b) => b.position - a.position);
		return roles;
	},
	onRequest: [fastify.authenticate, fastify.isAdmin],
});
