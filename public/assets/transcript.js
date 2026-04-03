(() => {
	const MOBILE_BP = 768;

	function vw() {
		return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
	}

	function isMobile() {
		return vw() <= MOBILE_BP;
	}

	function isPhoneDevice() {
		return typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 500;
	}

	function isPortrait() {
		return window.innerHeight > window.innerWidth;
	}

	function elById(id) {
		return document.getElementById(id);
	}

	function show(node, displayVal) {
		if (node) node.style.display = displayVal || 'block';
	}

	function hide(node) {
		if (node) node.style.display = 'none';
	}

	function clearDisplay(node) {
		if (node) node.style.display = '';
	}

	let activeTab = 'chat';

	function switchTab(tab) {
		activeTab = tab;

		const bar = elById('mobile-tab-bar');
		const sidebar = elById('s');
		const rightside = elById('r');
		const right = document.querySelector('.right');

		if (bar) {
			bar.querySelectorAll('button').forEach(b => {
				b.classList.toggle('active', b.dataset.tab === tab);
			});
		}

		hide(sidebar);
		hide(right);
		hide(rightside);

		if (tab === 'chat') {
			show(rightside, 'flex');
		} else if (tab === 'info') {
			show(sidebar, 'flex');
		} else if (tab === 'summary') {
			show(right, 'block');
		}
	}

	function buildTabBar() {
		if (elById('mobile-tab-bar')) return;

		const bar = document.createElement('div');
		bar.id = 'mobile-tab-bar';
		bar.className = 'mobile-tab-bar';
		bar.innerHTML =
			'<button data-tab="chat" class="active">' +
				'<i class="fa-solid fa-message"></i>' +
				'<span>Chat</span>' +
			'</button>' +
			'<button data-tab="info">' +
				'<i class="fa-solid fa-circle-info"></i>' +
				'<span>Info</span>' +
			'</button>' +
			'<button data-tab="summary">' +
				'<i class="fa-solid fa-list"></i>' +
				'<span>Summary</span>' +
			'</button>';

		bar.addEventListener('click', e => {
			const btn = e.target.closest('button[data-tab]');
			if (btn) switchTab(btn.dataset.tab);
		});

		document.body.appendChild(bar);
	}

	function tearDownMobile() {
		const bar = elById('mobile-tab-bar');
		if (bar) bar.remove();
		document.body.classList.remove('is-mobile');
		clearDisplay(elById('s'));
		clearDisplay(elById('r'));
		clearDisplay(document.querySelector('.right'));
	}

	function setupMobile() {
		document.body.classList.add('is-mobile');
		buildTabBar();
		switchTab('chat');
	}

	function handleResize() {
		if (isMobile()) {
			setupMobile();
		} else {
			tearDownMobile();
		}
	}

	function applyImmediately() {
		if (!isMobile()) return;
		document.body.classList.add('is-mobile');
		hide(elById('s'));
		const rightside = elById('r');
		if (rightside) rightside.style.display = 'flex';
		hide(document.querySelector('.right'));
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', applyImmediately);
	} else {
		applyImmediately();
	}

	window.addEventListener('load', () => {
		const loader = elById('loader');
		if (loader) loader.remove();
		fixAvatars();
		removeDuplicateMedia();
		handleResize();
		setupRotateOverlay();
	});

	window.addEventListener('resize', handleResize);

	window.openToggle = () => {
		if (!isMobile()) return;
		switchTab(activeTab === 'chat' ? 'info' : 'chat');
	};

function setupRotateOverlay() {
	const overlay = document.createElement('div');
	overlay.id = 'rotate-overlay';
	document.body.appendChild(overlay);

	overlay.innerHTML = `
		<div class="rotate-inner">
			<div class="rotate-phone-wrap">
				<svg class="rotate-phone" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
					<rect x="14" y="4" width="36" height="56" rx="6" ry="6" fill="none" stroke="currentColor" stroke-width="4"/>
					<circle cx="32" cy="53" r="2.5" fill="currentColor"/>
					<rect x="24" y="8" width="16" height="3" rx="1" fill="currentColor" opacity="0.4"/>
				</svg>
				<svg class="rotate-arrow" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
					<path d="M20 60 A30 30 0 1 1 60 60" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
					<polyline points="52,52 60,60 68,52" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
			<p class="rotate-title">Rotate your phone</p>
			<p class="rotate-sub">Landscape gives you the best experience</p>
			<button class="rotate-dismiss" id="rotate-dismiss">Continue in portrait</button>
		</div>
	`;

	let dismissed = false;

	document.getElementById('rotate-dismiss').addEventListener('click', () => {
		dismissed = true;
		overlay.classList.remove('show');
	});

	function updateOverlay() {
		if (typeof screen === 'undefined' || Math.min(screen.width, screen.height) >= 500) {
			overlay.classList.remove('show');
			return;
		}
		if (dismissed) return;

		if (window.innerHeight > window.innerWidth) {
			overlay.classList.add('show');
		} else {
			overlay.classList.remove('show');
			dismissed = false;
		}
	}

	window.addEventListener('resize', updateOverlay);
	window.addEventListener('orientationchange', () => setTimeout(updateOverlay, 200));
	updateOverlay();
}

	function removeDuplicateMedia() {
		function getAllSrcs(node) {
			const srcs = new Set();
			const d = node.getAttribute('src');
			if (d) srcs.add(d.split('?')[0]);
			node.querySelectorAll('source[src]').forEach(s => {
				const src = s.getAttribute('src');
				if (src) srcs.add(src.split('?')[0]);
			});
			return srcs;
		}

		function fname(url) {
			return url.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
		}

		function overlaps(a, b) {
			for (const x of a) {
				if (b.has(x)) return true;
				const f = fname(x);
				if (f) for (const y of b) if (f === fname(y)) return true;
			}
			return false;
		}

		document.querySelectorAll('.chat-msg').forEach(msg => {
			const body = msg.querySelector('.body');
			if (!body) return;

			const ivids = Array.from(body.querySelectorAll('video.inline-media'));
			const evids = Array.from(body.querySelectorAll('video:not(.inline-media)'));
			ivids.forEach(iv => {
				const s = getAllSrcs(iv);
				if (s.size && evids.some(ev => overlaps(s, getAllSrcs(ev)))) iv.remove();
			});

			const iimgs = Array.from(body.querySelectorAll('img.inline-media'));
			const eimgs = Array.from(body.querySelectorAll('img:not(.inline-media):not(.avatar)'));
			iimgs.forEach(ii => {
				const s = (ii.getAttribute('src') || '').split('?')[0];
				if (!s) return;
				if (eimgs.some(ei => {
					const es = (ei.getAttribute('src') || '').split('?')[0];
					return es === s || fname(s) === fname(es);
				})) ii.remove();
			});
		});
	}

	function fixAvatars() {
		const fallback = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2242%22 height%3D%2242%22 viewBox%3D%220 0 42 42%22%3E%3Ccircle cx%3D%2221%22 cy%3D%2221%22 r%3D%2221%22 fill%3D%22%23222631%22/%3E%3Ccircle cx%3D%2221%22 cy%3D%2216%22 r%3D%228%22 fill%3D%22%23a7abb5%22/%3E%3Cellipse cx%3D%2221%22 cy%3D%2236%22 rx%3D%2213%22 ry%3D%229%22 fill%3D%22%23a7abb5%22/%3E%3C/svg%3E';
		document.querySelectorAll('img.avatar').forEach(img => {
			img.addEventListener('error', function () {
				if (this.src !== fallback) this.src = fallback;
			});
			if (img.complete && img.naturalWidth === 0) img.src = fallback;
		});
	}

	const search = document.getElementById('search');
	if (search) {
		search.addEventListener('input', e => {
			const term = e.target.value.toLowerCase();
			document.querySelectorAll('.chat-msg').forEach(msg => {
				msg.style.display = msg.innerText.toLowerCase().includes(term) ? '' : 'none';
			});
		});
	}

	document.querySelectorAll('.chat-msg .body').forEach(b => {
		b.dataset.original = b.innerHTML;
	});

	document.addEventListener('click', async e => {
		const btn = e.target.closest('.copy-id-pill');
		if (!btn) return;
		e.stopPropagation();
		const id = btn.dataset.userId;
		if (!id) return;
		const original = btn.textContent;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(id);
			} else {
				const ta = document.createElement('textarea');
				ta.value = id;
				ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				ta.remove();
			}
			btn.classList.add('copied');
			btn.textContent = 'Copied';
			setTimeout(() => {
				btn.classList.remove('copied');
				btn.textContent = original;
			}, 1200);
		} catch (err) {
			console.error('copy failed', err);
		}
	});
})();