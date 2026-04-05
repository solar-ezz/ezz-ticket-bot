const { fetchTranscriptTicket } = require('../../../lib/transcript');
const { decrypt, encrypt } = require('../../../lib/crypto');
const { logRatingEvent } = require('../../../lib/logging');

module.exports.get = () => ({
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		const ticketId = req.params.ticket;
		let user;
		try {
			user = await req.jwtVerify();
		} catch {
			const redirect = encodeURIComponent(req.url);
			return res.redirect(`/auth/login?r=${redirect}`);
		}

		const ticket = await fetchTranscriptTicket(client, ticketId, req.query.guild);
		if (!ticket || ticket.createdById !== user.id) return res.code(403).send('Not allowed.');
		if (ticket.feedback) return res.redirect(`/transcripts/${ticketId}?rated=1`);

		const title = 'Rate your ticket';
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		body { font-family: "Inter", system-ui, -apple-system, sans-serif; background:#0b0c10; color:#e7e9f0; margin:0; padding:20px; display:flex; align-items:center; justify-content:center; min-height:100vh; }
		.card { width: 420px; max-width: 90vw; background:#11141a; border:1px solid #1f2330; border-radius:12px; padding:18px 20px; }
		h1 { margin:0 0 10px; font-size:20px; }
		label { display:block; margin:10px 0 6px; color:#a7abba; font-size:14px; }
		.stars { display:flex; gap:8px; margin:8px 0 12px; }
		.stars input { display:none; }
		.stars label { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; border:1px solid #2b3040; cursor:pointer; background:#0b0c10; color:#e7e9f0; }
		.stars input:checked + label { background:#5865f2; border-color:#5865f2; }
		textarea { width:100%; min-height:90px; background:#0b0c10; border:1px solid #2b3040; color:#e7e9f0; border-radius:10px; padding:10px; resize:vertical; }
		button { margin-top:14px; width:100%; padding:11px 12px; border:none; border-radius:10px; background:#5865f2; color:#fff; font-weight:700; cursor:pointer; }
		.subtle { color:#a7abba; font-size:13px; margin-top:4px; }
		a { color:#8fb0ff; text-decoration:none; }
	</style>
</head>
<body>
	<div class="card">
		<h1>${title}</h1>
		<form method="post" action="/transcripts/${ticketId}/feedback">
			<div class="stars">
				${[0,1,2,3,4,5].map(n => `<input type="radio" name="rating" id="r${n}" value="${n}" ${n===5?'checked':''}><label for="r${n}">${n}</label>`).join('')}
			</div>
			<label for="comment">Why did you rate it this way?</label>
			<textarea name="comment" id="comment" maxlength="500" placeholder="Optional"></textarea>
			<button type="submit">Submit rating</button>
		</form>
		<div class="subtle"><a href="/transcripts/${ticketId}">Back to transcript</a></div>
	</div>
</body>
</html>`;
		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(html);
	},
});

module.exports.post = () => ({
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		const ticketId = req.params.ticket;
		let user;
		try {
			user = await req.jwtVerify();
		} catch {
			const redirect = encodeURIComponent(req.url);
			return res.redirect(`/auth/login?r=${redirect}`);
		}

		const ticket = await fetchTranscriptTicket(client, ticketId, req.query.guild);
		if (!ticket || ticket.createdById !== user.id) return res.code(403).send('Not allowed.');
		if (ticket.feedback) return res.redirect(`/transcripts/${ticketId}?rated=1`);

		const rating = Math.max(0, Math.min(5, parseInt(req.body?.rating, 10) || 0));
		const commentRaw = (req.body?.comment || '').trim();
		const comment = commentRaw ? await encrypt(commentRaw) : null;

		await client.prisma.ticket.update({
			data: {
				feedback: {
					upsert: {
						create: {
							rating,
							comment,
							guild: { connect: { id: ticket.guildId } },
							user: { connect: { id: user.id } },
						},
						update: {
							rating,
							comment,
							user: { connect: { id: user.id } },
						},
					},
				},
			},
			where: { id: ticketId },
		});

		await logRatingEvent(client, {
			comment: commentRaw,
			rating,
			ticket,
			userId: user.id,
		});

		return res.redirect(`/transcripts/${ticketId}?rated=1`);
	},
});
