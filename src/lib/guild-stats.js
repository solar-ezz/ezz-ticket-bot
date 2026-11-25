const ms = require('ms');
const { decrypt } = require('./crypto');

const DAY = 86400000;
const RANGES = [7, 30, 90, 365];

const safeDecrypt = value => {
	if (!value) return value;
	try {
		return decrypt(value);
	} catch {
		return value;
	}
};

const average = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

const duration = value => (value === null ? '—' : ms(Math.round(value), { long: false }));

const zonedParts = (date, timeZone) => {
	try {
		const parts = new Intl.DateTimeFormat('en-GB', {
			hour: 'numeric',
			hourCycle: 'h23',
			timeZone,
			weekday: 'short',
		}).formatToParts(date);
		return {
			hour: Number(parts.find(p => p.type === 'hour').value),
			weekday: parts.find(p => p.type === 'weekday').value,
		};
	} catch {
		return {
			hour: date.getUTCHours(),
			weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()],
		};
	}
};

const resolveName = async (guild, id, archived) => {
	if (!id) return 'Unknown';
	const member = guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
	if (member) {
		return {
			avatar: member.displayAvatarURL({ size: 64 }),
			name: member.displayName,
		};
	}
	const a = archived.get(id);
	return {
		avatar: null,
		name: (a && (safeDecrypt(a.displayName) || safeDecrypt(a.username))) || 'Former member',
	};
};

const getGuildStats = async (client, guild, requestedDays) => {
	const days = RANGES.includes(Number(requestedDays)) ? Number(requestedDays) : 30;
	const now = Date.now();
	const since = new Date(now - days * DAY);
	const where = { guildId: guild.id };

	const [settings, categories, created, closed, openNow, feedback, allTime] = await Promise.all([
		client.prisma.guild.findUnique({
			select: { workingHours: true },
			where: { id: guild.id },
		}),
		client.prisma.category.findMany({
			select: {
				emoji: true,
				eventOnly: true,
				id: true,
				name: true,
			},
			where,
		}),
		client.prisma.ticket.findMany({
			select: {
				categoryId: true,
				claimedById: true,
				createdAt: true,
				createdById: true,
				firstResponseAt: true,
			},
			where: {
				...where,
				createdAt: { gte: since },
			},
		}),
		client.prisma.ticket.findMany({
			select: {
				closedAt: true,
				closedById: true,
				createdAt: true,
				createdById: true,
			},
			where: {
				...where,
				closedAt: { gte: since },
			},
		}),
		client.prisma.ticket.count({
			where: {
				...where,
				open: true,
			},
		}),
		client.prisma.feedback.findMany({
			orderBy: { createdAt: 'desc' },
			select: {
				comment: true,
				createdAt: true,
				rating: true,
				ticket: { select: { number: true } },
				ticketId: true,
				userId: true,
			},
			where: {
				...where,
				createdAt: { gte: since },
			},
		}),
		client.prisma.ticket.count({ where }),
	]);

	const timeZone = Array.isArray(settings?.workingHours) ? settings.workingHours[0] : 'UTC';

	const bucketSize = days > 90 ? 7 : 1;
	const bucketCount = Math.ceil(days / bucketSize);
	const start = now - bucketCount * bucketSize * DAY;
	const series = Array.from({ length: bucketCount }, (_, i) => ({
		closed: 0,
		created: 0,
		date: new Date(start + i * bucketSize * DAY + bucketSize * DAY),
	}));
	const bucketOf = date => {
		const index = Math.floor((date.getTime() - start) / (bucketSize * DAY));
		return series[Math.min(Math.max(index, 0), bucketCount - 1)];
	};
	for (const t of created) bucketOf(t.createdAt).created++;
	for (const t of closed) bucketOf(t.closedAt).closed++;

	const hours = Array(24).fill(0);
	const weekdays = {
		Fri: 0,
		Mon: 0,
		Sat: 0,
		Sun: 0,
		Thu: 0,
		Tue: 0,
		Wed: 0,
	};
	for (const t of created) {
		const {
			hour, weekday,
		} = zonedParts(t.createdAt, timeZone);
		hours[hour]++;
		if (weekday in weekdays) weekdays[weekday]++;
	}

	const categoryCounts = new Map();
	for (const t of created) categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) || 0) + 1);
	const byCategory = categories
		.map(c => ({
			count: categoryCounts.get(c.id) || 0,
			emoji: c.emoji,
			event: c.eventOnly,
			name: c.name,
		}))
		.sort((a, b) => b.count - a.count);

	const responseTimes = created.filter(t => t.firstResponseAt).map(t => t.firstResponseAt - t.createdAt);
	const resolutionTimes = closed.map(t => t.closedAt - t.createdAt);

	const staff = new Map();
	const bump = (id, key) => {
		if (!id) return;
		if (!staff.has(id)) {
			staff.set(id, {
				claimed: 0,
				closed: 0,
				id,
			});
		}
		staff.get(id)[key]++;
	};
	for (const t of created) bump(t.claimedById, 'claimed');
	for (const t of closed) if (t.closedById && t.closedById !== t.createdById) bump(t.closedById, 'closed');
	const topStaff = [...staff.values()]
		.sort((a, b) => (b.claimed + b.closed) - (a.claimed + a.closed))
		.slice(0, 8);

	const commented = feedback.filter(f => f.comment).slice(0, 6);
	const lookupIds = [...new Set([...topStaff.map(s => s.id), ...commented.map(f => f.userId).filter(Boolean)])];
	const archivedRows = lookupIds.length
		? await client.prisma.archivedUser.findMany({
			distinct: ['userId'],
			select: {
				displayName: true,
				userId: true,
				username: true,
			},
			where: { userId: { in: lookupIds } },
		})
		: [];
	const archived = new Map(archivedRows.map(a => [a.userId, a]));
	for (const s of topStaff) Object.assign(s, await resolveName(guild, s.id, archived));

	const ratings = [0, 0, 0, 0, 0];
	for (const f of feedback) if (f.rating >= 1 && f.rating <= 5) ratings[f.rating - 1]++;
	const avgRating = average(feedback.map(f => f.rating));

	const recentFeedback = [];
	for (const f of commented) {
		recentFeedback.push({
			comment: safeDecrypt(f.comment),
			createdAt: f.createdAt,
			number: f.ticket?.number,
			rating: f.rating,
			user: f.userId ? (await resolveName(guild, f.userId, archived)).name : 'Anonymous',
		});
	}

	const eventIds = new Set(categories.filter(c => c.eventOnly).map(c => c.id));
	const uniqueOpeners = new Set(created.map(t => t.createdById)).size;

	return {
		allTime,
		avgRating: avgRating === null ? null : avgRating.toFixed(2),
		avgResolution: duration(average(resolutionTimes)),
		avgResponse: duration(average(responseTimes)),
		bucketSize,
		byCategory,
		closed: closed.length,
		created: created.length,
		days,
		eventSignups: created.filter(t => eventIds.has(t.categoryId)).length,
		hours,
		openNow,
		ranges: RANGES,
		ratings,
		ratingsCount: feedback.length,
		recentFeedback,
		responseRate: created.length ? Math.round((responseTimes.length / created.length) * 100) : null,
		series,
		timeZone,
		topStaff,
		uniqueOpeners,
		weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({
			count: weekdays[d],
			day: d,
		})),
	};
};

module.exports = { getGuildStats };
