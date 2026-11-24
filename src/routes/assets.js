const {
	readFileSync, existsSync, statSync,
} = require('fs');
const {
	dirname, join, normalize, sep,
} = require('path');

const TYPES = {
	css: 'text/css; charset=utf-8',
	gif: 'image/gif',
	ico: 'image/x-icon',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	js: 'application/javascript; charset=utf-8',
	png: 'image/png',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	woff2: 'font/woff2',
};

const roots = () => {
	const list = [join(process.cwd(), 'public', 'assets')];
	try {
		list.push(join(dirname(require.resolve('@discord-tickets/settings/package.json')), 'build', 'client', 'assets'));
	} catch {
		return list.map(normalize);
	}
	return list.map(normalize);
};

const resolveAsset = slug => {
	for (const base of roots()) {
		const target = normalize(join(base, slug));
		if (!target.startsWith(base + sep)) continue;
		if (existsSync(target) && statSync(target).isFile()) return target;
	}
	return null;
};

module.exports.get = () => ({
	path: '/assets/*',
	handler: (req, res) => {
		const target = resolveAsset(req.params['*'] || '');
		if (!target) return res.code(404).send('Not found');
		const ext = target.split('.').pop().toLowerCase();
		res.header('Content-Type', TYPES[ext] || 'application/octet-stream');
		res.header('Cache-Control', 'public, max-age=3600');
		return res.send(readFileSync(target));
	},
});
