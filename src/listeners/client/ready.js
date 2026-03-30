const { Listener } = require('@eartharoid/dbf');
const ms = require('ms');
const sync = require('../../lib/sync');
const checkForUpdates = require('../../lib/updates');
const {
	getAverageTimes,
	sendToHouston,
} = require('../../lib/stats');
const handleStaleTickets = require('../../lib/stale');

module.exports = class extends Listener {
	constructor(client, options) {
		super(client, {
			...options,
			emitter: client,
			event: 'clientReady',
			once: true,
		});
	}

	async run() {
		const client = this.client;

		process.title = 'tickets';
		client.log.success('Connected to Discord as "%s" over %d shards', client.user.tag, client.ws.shards.size);

		await client.initAfterLogin();

		await sync(client);

		if (process.env.PUBLISH_COMMANDS === 'true') {
			client.log.info('Automatically publishing commands...');
			const guildId = process.env.COMMAND_GUILD_ID;
			const publisher = guildId
				? client.application.commands.set(
					client.commands.components.map(c => c.toJSON()),
					guildId,
				)
				: client.commands.publish();
			publisher
				.then(commands => client.log.success('Published %d commands%s', commands?.size ?? commands?.length ?? 0, guildId ? ` to guild ${guildId}` : ''))
				.catch(client.log.error);
		}

		await client.application.fetch();
		if (process.env.PUBLIC_BOT === 'true' && !client.application.botPublic) {
			client.log.warn('The `PUBLIC_BOT` environment variable is set to `true`, but the bot is not public.');
		} else if (process.env.PUBLIC_BOT !== 'true' && client.application.botPublic) {
			client.log.warn('Your bot is public, but public features are disabled. Set the `PUBLIC_BOT` environment variable to `true`, or make your bot private.');
		}

		await client.application.commands.fetch();

		if (client.config.presence.activities?.length > 0) {
			let next = 0;
			const setPresence = async () => {
				client.log.verbose.cron('Updating presence');
				const cacheKey = 'cache/presence';
				let cached = await client.keyv.get(cacheKey);
				if (!cached) {
					const tickets = await client.prisma.ticket.findMany({
						select: {
							closedAt: true,
							createdAt: true,
							feedback: { select: { rating: true } },
							firstResponseAt: true,
						},
					});
					const closedTickets = tickets.filter(t => t.closedAt);
					const closedTicketsWithResponse = closedTickets.filter(t => t.firstResponseAt);
					const {
						avgResolutionTime,
						avgResponseTime,
					} = await getAverageTimes(closedTicketsWithResponse);
					const ratingValues = closedTickets
						.map(t => t.feedback?.rating)
						.filter(r => typeof r === 'number');
					const ratingCount = ratingValues.length;
					const avgRatingValue = ratingCount ? (ratingValues.reduce((t, r) => t + r, 0) / ratingCount) : 0;
					const fmt = v => {
						const totalSeconds = Math.max(0, Math.floor(v / 1000));
						const days = Math.floor(totalSeconds / 86400);
						const hours = Math.floor((totalSeconds % 86400) / 3600);
						const mins = Math.floor((totalSeconds % 3600) / 60);
						const secs = totalSeconds % 60;
						const parts = [];
						if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
						if (hours) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
						if (!days && !hours && mins) parts.push(`${mins} min${mins !== 1 ? 's' : ''}`);
						if (parts.length === 0) parts.push(`${secs} sec${secs !== 1 ? 's' : ''}`);
						if (parts.length > 2) return parts.slice(0, 2).join(' ');
						return parts.join(' ');
					};

					const fmtRating = value => {
						const v = Number(value) || 0;
						const fixed = v.toFixed(1);
						return fixed.endsWith('.0') ? String(Math.round(v)) : fixed;
					};

					cached = {
						avgRating: `${fmtRating(avgRatingValue)}/5`,
						avgRatingValue: fmtRating(avgRatingValue),
						ratingCount,
						avgResolutionTime: fmt(avgResolutionTime),
						avgResponseTime: fmt(avgResponseTime),
						guilds: client.guilds.cache.size,
						openTickets: tickets.length - closedTickets.length,
						totalTickets: tickets.length,
					};
					await client.keyv.set(cacheKey, cached, ms('5m'));
				}
				const activity = { ...client.config.presence.activities[next] };
				activity.name = activity.name
					.replace(/{+avgResolutionTime}+/gi, cached.avgResolutionTime)
					.replace(/{+avgResponseTime}+/gi, cached.avgResponseTime)
					.replace(/{+avgRating}+/gi, cached.avgRating)
					.replace(/{+avgRatingValue}+/gi, cached.avgRatingValue)
					.replace(/{+ratingCount}+/gi, cached.ratingCount)
					.replace(/{+guilds}+/gi, cached.guilds)
					.replace(/{+openTickets}+/gi, cached.openTickets)
					.replace(/{+totalTickets}+/gi, cached.totalTickets);
				client.user.setPresence({
					activities: [activity],
					status: client.config.presence.status,
				});
				next++;
				if (next === client.config.presence.activities.length) next = 0;
			};
			setPresence();
			if (client.config.presence.activities.length > 1) setInterval(() => setPresence(), client.config.presence.interval * 1000);
		} else {
			client.log.info('Presence activities are disabled');
		}

		if (client.config.stats) {
			sendToHouston(client);
			setInterval(() => sendToHouston(client), ms('12h'));
		}

		if (client.config.updates) {
			checkForUpdates(client);
			setInterval(() => checkForUpdates(client), ms('1w'));
		}

		if (process.env.PUBLIC_BOT === 'true') {
			client.log.notice('Inactivity warnings and auto-close features are disabled');
			client.log.warn('Unset PUBLIC_BOT to re-enable stale ticket handling');
		} else {
			const staleInterval = ms('15m');
			setInterval(() => handleStaleTickets(client, staleInterval), staleInterval);
		}
	}
};
