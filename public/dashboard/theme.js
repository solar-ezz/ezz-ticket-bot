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

	const apply = () => {
		if (/Discord Tickets/.test(document.title)) document.title = swap(document.title);
		walk(document.body);
		brandHeader();
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
