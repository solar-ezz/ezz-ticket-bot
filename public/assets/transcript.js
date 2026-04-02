(() => {
	function escapeHtml(str) {
		return (str || '').replace(/[&<>"']/g, m => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		}[m]));
	}

	window.addEventListener('load', () => {
		const loader = document.getElementById('loader');
		if (loader) loader.remove();
		fixAvatars();
		removeDuplicateMedia();
		setupMobileTabs();
		setupRotateOverlay();
	});

	function isMobile() {
		return window.innerWidth < 750 || window.innerHeight < 750;
	}

	function isPortrait() {
		return window.innerHeight > window.innerWidth;
	}

	function setupRotateOverlay() {
		if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

		const overlay = document.createElement('div');
		overlay.id = 'rotate-overlay';
		overlay.innerHTML =
			'<div class="rotate-inner">' +
				'<div class="rotate-phone-wrap">' +
					'<svg class="rotate-phone" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
						'<rect x="14" y="4" width="36" height="56" rx="6" ry="6" fill="none" stroke="currentColor" stroke-width="3"/>' +
						'<circle cx="32" cy="53" r="2.5" fill="currentColor"/>' +
						'<rect x="24" y="8" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>' +
					'</svg>' +
					'<svg class="rotate-arrow" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
						'<path d="M 20 60 A 30 30 0 1 1 60 60" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>' +
						'<polyline points="52,52 60,60 68,52" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
					'</svg>' +
				'</div>' +
				'<p class="rotate-title">Rotate your phone</p>' +
				'<p class="rotate-sub">Landscape mode gives you the best transcript experience</p>' +
				'<button class="rotate-dismiss" id="rotate-dismiss">Continue in portrait</button>' +
			'</div>';
		document.body.appendChild(overlay);

		let dismissed = false;

		document.getElementById('rotate-dismiss').addEventListener('click', () => {
			dismissed = true;
			overlay.classList.add('rotate-hidden');
		});

		function update() {
			if (dismissed) return;
			const mobile = isMobile();
			const portrait = isPortrait();
			if (mobile && portrait) {
				overlay.classList.remove('rotate-hidden');
			} else {
				overlay.classList.add('rotate-hidden');
				dismissed = false;
			}
		}

		window.addEventListener('resize', update);
		window.addEventListener('orientationchange', () => setTimeout(update, 120));
		update();
	}

	let activeTab = 'chat';

	function setupMobileTabs() {
		if (!isMobile()) return;

		const bar = document.createElement('div');
		bar.className = 'mobile-tab-bar';
		bar.id = 'mobile-tab-bar';
		bar.innerHTML =
			'<button class="active" data-tab="chat"><i class="fa-solid fa-message"></i>Chat</button>' +
			'<button data-tab="info"><i class="fa-solid fa-circle-info"></i>Info</button>' +
			'<button data-tab="summary"><i class="fa-solid fa-list"></i>Summary</button>';
		document.body.appendChild(bar);

		bar.addEventListener('click', e => {
			const btn = e.target.closest('button');
			if (!btn) return;
			switchTab(btn.dataset.tab);
		});

		switchTab('chat');
	}

	function switchTab(tab) {
		activeTab = tab;
		const bar = document.getElementById('mobile-tab-bar');
		const sidebar = document.getElementById('s');
		const rightside = document.getElementById('r');
		const right = document.querySelector('.right');

		if (!bar) return;

		bar.querySelectorAll('button').forEach(b => {
			b.classList.toggle('active', b.dataset.tab === tab);
		});

		if (sidebar) sidebar.classList.remove('tab-active');
		if (right) right.classList.remove('tab-active');
		if (rightside) rightside.classList.remove('tab-hidden');

		if (tab === 'info') {
			if (sidebar) sidebar.classList.add('tab-active');
			if (rightside) rightside.classList.add('tab-hidden');
		} else if (tab === 'summary') {
			if (right) right.classList.add('tab-active');
			if (rightside) rightside.classList.add('tab-hidden');
		}
	}

	window.addEventListener('resize', () => {
		const bar = document.getElementById('mobile-tab-bar');
		if (!isMobile()) {
			if (bar) bar.remove();
			const sidebar = document.getElementById('s');
			const rightside = document.getElementById('r');
			const right = document.querySelector('.right');
			if (sidebar) { sidebar.classList.remove('tab-active'); sidebar.style.display = ''; }
			if (rightside) { rightside.classList.remove('tab-hidden'); rightside.style.display = ''; }
			if (right) right.classList.remove('tab-active');
		} else if (!bar) {
			setupMobileTabs();
		}
	});

	function removeDuplicateMedia() {
		function getAllSrcs(el) {
			const srcs = new Set();
			const direct = el.getAttribute('src');
			if (direct) srcs.add(direct.split('?')[0]);
			el.querySelectorAll('source[src]').forEach(s => {
				const src = s.getAttribute('src');
				if (src) srcs.add(src.split('?')[0]);
			});
			return srcs;
		}

		function toFilename(url) {
			return url.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
		}

		function srcSetsOverlap(aSet, bSet) {
			for (const a of aSet) {
				if (bSet.has(a)) return true;
				const af = toFilename(a);
				if (af) {
					for (const b of bSet) {
						if (af === toFilename(b)) return true;
					}
				}
			}
			return false;
		}

		document.querySelectorAll('.chat-msg').forEach(msg => {
			const body = msg.querySelector('.body');
			if (!body) return;

			const inlineVids = Array.from(body.querySelectorAll('video.inline-media'));
			const embedVids = Array.from(body.querySelectorAll('video:not(.inline-media)'));

			inlineVids.forEach(iv => {
				const ivSrcs = getAllSrcs(iv);
				if (!ivSrcs.size) return;
				const isDupe = embedVids.some(ev => srcSetsOverlap(ivSrcs, getAllSrcs(ev)));
				if (isDupe) iv.remove();
			});

			const inlineImgs = Array.from(body.querySelectorAll('img.inline-media'));
			const embedImgs = Array.from(body.querySelectorAll('img:not(.inline-media):not(.avatar)'));

			inlineImgs.forEach(ii => {
				const iiSrc = ii.getAttribute('src')?.split('?')[0] || '';
				if (!iiSrc) return;
				const isDupe = embedImgs.some(ei => {
					const eiSrc = ei.getAttribute('src')?.split('?')[0] || '';
					return eiSrc === iiSrc || toFilename(iiSrc) === toFilename(eiSrc);
				});
				if (isDupe) ii.remove();
			});
		});
	}

	function fixAvatars() {
		document.querySelectorAll('img.avatar').forEach(img => {
			const fallback = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2242%22 height%3D%2242%22 viewBox%3D%220 0 42 42%22%3E%3Ccircle cx%3D%2221%22 cy%3D%2221%22 r%3D%2221%22 fill%3D%22%23222631%22/%3E%3Ccircle cx%3D%2221%22 cy%3D%2216%22 r%3D%228%22 fill%3D%22%23a7abb5%22/%3E%3Cellipse cx%3D%2221%22 cy%3D%2236%22 rx%3D%2213%22 ry%3D%229%22 fill%3D%22%23a7abb5%22/%3E%3C/svg%3E';
			img.addEventListener('error', function () {
				if (this.src !== fallback) this.src = fallback;
			});
			if (img.complete && img.naturalWidth === 0) img.src = fallback;
		});
	}

	let toggleOpen = false;
	window.openToggle = () => {
		if (!isMobile()) return;
		const newTab = activeTab === 'chat' ? 'info' : 'chat';
		switchTab(newTab);
		toggleOpen = !toggleOpen;
	};

	const search = document.getElementById('search');
	if (search) {
		search.addEventListener('input', e => {
			const term = e.target.value.toLowerCase();
			document.querySelectorAll('.chat-msg').forEach(msg => {
				msg.style.display = msg.innerText.toLowerCase().includes(term) ? '' : 'none';
			});
		});
	}

	const bodies = document.querySelectorAll('.chat-msg .body');
	bodies.forEach(el => { el.dataset.original = el.innerHTML; });

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