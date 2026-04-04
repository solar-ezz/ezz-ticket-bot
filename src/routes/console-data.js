const roleId = '1341077029432328202';

module.exports.get = fastify => ({
	path: '/console/data',
	onRequest: [fastify.authenticate],
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		const hasMembersReadScope = Array.isArray(req.user?.scopes) && req.user.scopes.includes('guilds.members.read');
		const accessToken = req.user?.accessToken;

		let guildWithRole = null;
		let roleWithGuild = null;
		let memberWithRole = null;
		let roleFound = false;
		let memberFound = false;
		let tokenInvalid = false;

		for (const guild of client.guilds.cache.values()) {
			let role = guild.roles.cache.get(roleId);
			if (!role) {
				role = await guild.roles.fetch(roleId).catch(() => null);
			}
			if (role) {
				roleFound = true;
				const member = await guild.members.fetch(req.user.id).catch(() => null);
				if (member) {
					memberFound = true;
					if (member.roles.cache.has(roleId)) {
						guildWithRole = guild;
						roleWithGuild = role;
						memberWithRole = member;
						break;
					}
				} else if (hasMembersReadScope && accessToken) {
					const resp = await fetch(`https://discord.com/api/users/@me/guilds/${guild.id}/member`, {
						headers: { 'Authorization': `Bearer ${accessToken}` },
					}).catch(() => null);

					if (resp?.ok) {
						const memberData = await resp.json();
						memberFound = true;
						if (Array.isArray(memberData.roles) && memberData.roles.includes(roleId)) {
							guildWithRole = guild;
							roleWithGuild = role;
							memberWithRole = memberData;
							break;
						}
					} else if (resp && [401, 403].includes(resp.status)) {
						tokenInvalid = true;
					}
				}
			}
		}
		if (!guildWithRole || !roleWithGuild || !memberWithRole) {
			if (!roleFound) {
				return res.code(403).send({
					error: 'Forbidden',
					message: 'Required role not found in any guild.',
					statusCode: 403,
				});
			}
			if (tokenInvalid) {
				return res.code(401).send({
					error: 'Unauthorized',
					message: 'Session expired. Please re-login to refresh access.',
					statusCode: 401,
				});
			}
			if (!memberFound && !hasMembersReadScope) {
				return res.code(401).send({
					error: 'Unauthorized',
					message: 'Please re-login so we can verify your membership (missing guilds.members.read).',
					statusCode: 401,
				});
			}
			if (!memberFound) {
				return res.code(403).send({
					error: 'Forbidden',
					message: 'Guild membership required where the role exists.',
					statusCode: 403,
				});
			}
			if (!hasMembersReadScope) {
				return res.code(401).send({
					error: 'Unauthorized',
					message: 'Additional permission required. Please re-login to grant guilds.members.read.',
					statusCode: 401,
				});
			}
			return res.code(403).send({
				error: 'Forbidden',
				message: 'Required role missing.',
				statusCode: 403,
			});
		}
		return {
			guild: {
				id: guildWithRole.id,
				name: guildWithRole.name,
			},
			role: {
				color: roleWithGuild.color,
				hex: roleWithGuild.hexColor,
				id: roleId,
				name: roleWithGuild.name,
			},
			user: {
				avatar: req.user.avatar,
				id: req.user.id,
				username: req.user.username,
			},
		};
	},
});
