const { readFileSync } = require('fs');
const { join } = require('path');

module.exports.get = fastify => ({
	path: '/console',
	handler: async (req, res) => {
		const target = join(process.cwd(), 'public', 'console', 'index.html');
		try {
			const html = readFileSync(target, 'utf-8');
			res.header('Content-Type', 'text/html; charset=utf-8');
			return res.send(html);
		} catch (error) {
			req.log?.error?.(error);
			return res.code(500).send('Console page unavailable.');
		}
	},
});
