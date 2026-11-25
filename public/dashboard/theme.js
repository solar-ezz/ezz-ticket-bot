(() => {
	const BRAND = 'Ezz Tickets';
	const swap = text => text.replace(/Discord Tickets/g, BRAND).replace(/DISCORD TICKETS/g, BRAND.toUpperCase());

	const walk = root => {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let node;
		while ((node = walker.nextNode())) {
			if (/Discord Tickets|DISCORD TICKETS/.test(node.nodeValue)) node.nodeValue = swap(node.nodeValue);
		}
	};

	const brandHeader = () => {
		for (const img of document.querySelectorAll('img[src*="wordmark"]:not([data-ezz])')) {
			img.dataset.ezz = '1';
			const brand = document.createElement('span');
			brand.className = 'ezz-brand';
			brand.innerHTML = '<img src="/ezz/logo.svg" alt=""><span>Ezz <b>Tickets</b></span>';
			img.style.display = 'none';
			img.after(brand);
		}
		for (const img of document.querySelectorAll('img[src*="/null."]:not([data-ezz])')) {
			img.dataset.ezz = '1';
			img.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
		}
	};

	const TILES = [
		['stats', 'fa-chart-line', 'Stats', g => `/settings/${g}/stats`],
		['events', 'fa-trophy', 'Events', g => `/settings/${g}/events`],
		['history', 'fa-clock-rotate-left', 'Ticket history', () => '/transcripts'],
		['ratings', 'fa-star', 'Ratings', () => '/rating'],
	];

	const addTiles = () => {
		const match = location.pathname.match(/^\/settings\/(\d{17,20})\/?$/);
		if (!match) return;
		const template = document.querySelector('a.link[href$="/general"]');
		const grid = template?.parentElement;
		if (!grid || grid.querySelector('[data-ezz-tile]')) return;
		const anchor = [...grid.children].find(el => el.tagName === 'BUTTON') || null;
		for (const [key, icon, label, href] of TILES) {
			const tile = template.cloneNode(true);
			tile.dataset.ezzTile = key;
			tile.setAttribute('href', href(match[1]));
			tile.setAttribute('data-sveltekit-reload', '');
			const i = tile.querySelector('i');
			if (i) i.className = `fas ${icon} mb-4 text-4xl`;
			const p = tile.querySelector('p');
			if (p) p.textContent = label;
			grid.insertBefore(tile, anchor);
		}
	};

	const apply = () => {
		if (/Discord Tickets/.test(document.title)) document.title = swap(document.title);
		walk(document.body);
		brandHeader();
		addTiles();
	};

	let queued = false;
	const schedule = () => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			apply();
		});
	};

	const start = () => {
		apply();
		new MutationObserver(schedule).observe(document.body, { characterData: true, childList: true, subtree: true });
		new MutationObserver(schedule).observe(document.head, { characterData: true, childList: true, subtree: true });
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
