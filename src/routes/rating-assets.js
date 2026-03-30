const { readFileSync, existsSync, statSync } = require('fs');
const { join, normalize } = require('path');

module.exports.get = () => ({
	path: '/rating/*',
	handler: (req, res) => {
		const slug = req.params['*'] || '';
		const target = normalize(join(process.cwd(), 'public', 'rating', slug));
		const base = normalize(join(process.cwd(), 'public', 'rating'));
		if (!target.startsWith(base) || !existsSync(target) || !statSync(target).isFile()) {
			return res.code(404).send('Not found');
		}
		const ext = target.split('.').pop().toLowerCase();
		const type = {
			css: 'text/css; charset=utf-8',
			js: 'application/javascript; charset=utf-8',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			webp: 'image/webp',
			ico: 'image/x-icon',
			svg: 'image/svg+xml',
		}[ext] || 'application/octet-stream';
		res.header('Content-Type', type);
		return res.send(readFileSync(target));
	},
});
