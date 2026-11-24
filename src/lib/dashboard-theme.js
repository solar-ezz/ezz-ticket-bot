const {
	existsSync,
	readFileSync,
} = require('fs');
const {
	basename,
	dirname,
	join,
} = require('path');

const PUBLIC_DIR = join(__dirname, '../../public/dashboard');
const THEME_VERSION = '1';

const PALETTE = {
	'100 116 139': '104 110 128',
	'148 163 184': '150 156 172',
	'15 23 42': '9 10 14',
	'203 213 225': '208 212 222',
	'226 232 240': '231 233 240',
	'229 231 235': '238 239 244',
	'30 41 59': '27 30 39',
	'51 65 85': '19 21 28',
	'71 85 105': '46 50 64',
	'88 101 242': '124 92 255',
};

const HEX_PALETTE = {
	'#0f172a': '#090a0e',
	'#2f3136': '#090a0e',
	'#5865f2': '#7c5cff',
};

const swapPalette = css => {
	let out = css.replace(/rgb\((\d+ \d+ \d+)/g, (match, triple) => (PALETTE[triple] ? `rgb(${PALETTE[triple]}` : match));
	for (const [from, to] of Object.entries(HEX_PALETTE)) out = out.replace(new RegExp(from, 'gi'), to);
	return out;
};

const INJECT = [
	'<link rel="preconnect" href="https://fonts.googleapis.com">',
	'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
	'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">',
	`<link rel="stylesheet" href="/ezz/theme.css?v=${THEME_VERSION}">`,
	`<link rel="icon" type="image/svg+xml" href="/ezz/logo.svg?v=${THEME_VERSION}">`,
	'<meta name="theme-color" content="#090a0e">',
	`<script src="/ezz/theme.js?v=${THEME_VERSION}" defer></script>`,
].join('');

const transformHtml = html => html
	.replace(/<title>([^<]*)Discord Tickets([^<]*)<\/title>/i, '<title>$1Ezz Tickets$2</title>')
	.replace('</head>', `${INJECT}</head>`);

const injectInto = res => {
	const raw = res.raw;
	const writeHead = raw.writeHead.bind(raw);
	const write = raw.write.bind(raw);
	const end = raw.end.bind(raw);
	let html = null;
	let head = null;

	raw.writeHead = (status, ...args) => {
		const headers = args.find(a => a && typeof a === 'object' && !Array.isArray(a));
		const type = String(headers?.['content-type'] ?? headers?.['Content-Type'] ?? raw.getHeader('content-type') ?? '');
		if (!type.includes('text/html') || raw.getHeader('content-encoding')) return writeHead(status, ...args);
		html = [];
		head = [status, headers];
		return raw;
	};

	raw.write = (chunk, encoding, callback) => {
		if (!html) return write(chunk, encoding, callback);
		html.push(Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
		if (typeof callback === 'function') callback();
		else if (typeof encoding === 'function') encoding();
		return true;
	};

	raw.end = (chunk, encoding, callback) => {
		if (!html) return end(chunk, encoding, callback);
		if (chunk && typeof chunk !== 'function') html.push(Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
		const body = Buffer.from(transformHtml(Buffer.concat(html).toString('utf8')), 'utf8');
		const [status, headers] = head;
		html = null;
		raw.removeHeader('content-length');
		if (headers) {
			delete headers['content-length'];
			delete headers['Content-Length'];
		}
		raw.setHeader('content-length', body.length);
		writeHead(status, ...(headers ? [headers] : []));
		return end(body, typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : callback);
	};
};

const STATIC_TYPES = {
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.svg': 'image/svg+xml',
};

module.exports = (fastify, handler) => {
	const settingsBuild = dirname(require.resolve('@discord-tickets/settings/package.json'));
	const assetsDir = join(settingsBuild, 'build/client/_app/immutable/assets');
	const cssCache = new Map();

	fastify.get('/ezz/:file', (req, res) => {
		const file = basename(req.params.file);
		const ext = file.slice(file.lastIndexOf('.'));
		const path = join(PUBLIC_DIR, file);
		if (!STATIC_TYPES[ext] || !existsSync(path)) return res.code(404).send({ statusCode: 404 });
		res.header('cache-control', 'public, max-age=3600');
		res.type(STATIC_TYPES[ext]);
		return res.send(readFileSync(path));
	});

	fastify.get('/_app/immutable/assets/:file', (req, res) => {
		const file = basename(req.params.file);
		if (!file.endsWith('.css')) return handler(req.raw, res.raw, () => {});
		if (!cssCache.has(file)) {
			const path = join(assetsDir, file);
			if (!existsSync(path)) return res.code(404).send({ statusCode: 404 });
			cssCache.set(file, swapPalette(readFileSync(path, 'utf8')));
		}
		res.header('cache-control', 'public, max-age=86400');
		res.type('text/css; charset=utf-8');
		return res.send(cssCache.get(file));
	});

	fastify.all('/*', {}, (req, res) => {
		injectInto(res);
		handler(req.raw, res.raw, () => {});
	});
};

module.exports.swapPalette = swapPalette;
module.exports.transformHtml = transformHtml;
