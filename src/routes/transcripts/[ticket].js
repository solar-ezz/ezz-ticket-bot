const {
	buildTranscriptUrls,
	buildTranscriptViewModel,
	ensureMarkdownBackup,
	fetchTranscriptTicket,
	hasTranscriptAccess,
	renderHtml,
	renderMarkdown,
	validateTranscriptToken,
} = require('../../lib/transcript');

module.exports.get = () => ({
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		const ticketId = req.params.ticket;
		if (!ticketId) return res.redirect('/transcripts');

		const ticket = await fetchTranscriptTicket(client, ticketId, req.query.guild);
		if (!ticket) {
			return res.code(404).send('Transcript not found.');
		}

		res.header('Cache-Control', 'no-store');
		res.header('X-Transcript-Renderer', 'ezz-v4');

		const token = req.query.token;
		const tokenValid = await validateTranscriptToken(client, token, ticket.id);

		let viewerId = null;
		if (!tokenValid) {
			try {
				const user = await req.jwtVerify();
				viewerId = user.id;
			} catch {
				const redirect = encodeURIComponent(req.url);
				return res.redirect(`/auth/login?r=${redirect}`);
			}
			if (!await hasTranscriptAccess(client, ticket, viewerId)) {
				return res.code(403).send('You do not have permission to view this transcript.');
			}
		}

		const urls = tokenValid
			? buildTranscriptUrls(ticket.id, token)
			: buildTranscriptUrls(ticket.id);

		const viewModel = await buildTranscriptViewModel(client, ticket);
		viewModel.downloadUrl = urls.downloadUrl;
		viewModel.transcriptUrl = urls.viewUrl;

		const markdown = renderMarkdown(client, viewModel);
		await ensureMarkdownBackup(viewModel.mdFileName, markdown);

		const html = renderHtml(client, viewModel);
		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(html);
	},
});
