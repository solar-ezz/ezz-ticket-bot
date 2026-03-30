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

const { existsSync, readFileSync } = require('fs');
const { join, extname } = require('path');

const ASSETS_DIR = join(process.cwd(), 'node_modules', '@discord-tickets', 'settings', 'build', 'client', '_app', 'immutable', 'assets');

module.exports.get = () => ({
	handler: async (req, res) => {
		const { client } = req.routeOptions.config;
		const ticketId = req.params.ticket;
		if (!ticketId) return res.redirect('/transcripts');

		// Serve font assets referenced by the embedded settings CSS
		if (/\.(woff2|ttf)$/i.test(ticketId)) {
			const assetPath = join(ASSETS_DIR, ticketId);
			if (!assetPath.startsWith(ASSETS_DIR) || !existsSync(assetPath)) {
				return res.code(404).send('Asset not found.');
			}
			const type = extname(assetPath).toLowerCase() === '.woff2' ? 'font/woff2' : 'font/ttf';
			res.header('Content-Type', type);
			return res.send(readFileSync(assetPath));
		}

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
		viewModel.backUrl = '/transcripts';

		const markdown = renderMarkdown(client, viewModel);
		await ensureMarkdownBackup(viewModel.mdFileName, markdown);

		const html = renderHtml(client, viewModel);
		res.header('Content-Type', 'text/html; charset=utf-8');
		return res.send(html);
	},
});
