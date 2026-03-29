(() => {

	window.addEventListener('load', () => {
		const loader = document.getElementById('loader');
		if (loader) loader.remove();

		fixAvatars();
		deduplicateMedia();
		fixEmbedSpacing();
	});

	function fixAvatars() {
		document.querySelectorAll('img.avatar').forEach(img => {
			img.addEventListener('error', function () {
				this.classList.add('avatar-error');
				this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"%3E%3Ccircle cx="21" cy="21" r="21" fill="%23222631"/%3E%3Ccircle cx="21" cy="17" r="8" fill="%23a7abb5"/%3E%3Cellipse cx="21" cy="36" rx="13" ry="9" fill="%23a7abb5"/%3E%3C/svg%3E';
				this.onerror = null;
			});
			if (!img.complete || img.naturalWidth === 0) {
				img.dispatchEvent(new Event('error'));
			}
		});
	}

	function deduplicateMedia() {
		document.querySelectorAll('.chat-msg .body').forEach(body => {
			const seenSrcs = new Set();
			const allMedia = body.querySelectorAll('img.inline-media, video.inline-media, iframe.inline-media');

			allMedia.forEach(el => {
				const src = el.src || el.getAttribute('src') || '';
				if (!src) return;

				const normalSrc = src.split('?')[0].toLowerCase();

				if (seenSrcs.has(normalSrc)) {
					const parent = el.closest('.embed-card') || el.parentElement;
					if (parent && parent !== body) {
						parent.remove();
					} else {
						el.remove();
					}
				} else {
					seenSrcs.add(normalSrc);
				}
			});

			const embedMediaWrap = body.querySelector('.embed-media');
			if (embedMediaWrap) {
				const cards = embedMediaWrap.querySelectorAll('.embed-card');
				const seenCardSrcs = new Set();
				cards.forEach(card => {
					const imgs = card.querySelectorAll('img.inline-media, video.inline-media');
					if (imgs.length === 0) return;
					const firstSrc = (imgs[0].src || '').split('?')[0].toLowerCase();
					if (!firstSrc) return;
					if (seenCardSrcs.has(firstSrc)) {
						card.remove();
					} else {
						seenCardSrcs.add(firstSrc);
					}
				});
			}

			const directImgs = body.querySelectorAll(':scope > img.inline-media');
			const embedImgs = body.querySelectorAll('.embed-card img.inline-media');
			const embedSrcs = new Set();
			embedImgs.forEach(img => {
				embedSrcs.add((img.src || '').split('?')[0].toLowerCase());
			});
			directImgs.forEach(img => {
				const s = (img.src || '').split('?')[0].toLowerCase();
				if (embedSrcs.has(s)) {
					img.remove();
				}
			});
		});
	}

	function fixEmbedSpacing() {
		document.querySelectorAll('.embed-card, .embed-json, .embed-description, .embed-field-value').forEach(el => {
			if (el.childNodes.length === 0) return;
			el.childNodes.forEach(node => {
				if (node.nodeType === Node.TEXT_NODE) {
					node.textContent = node.textContent.replace(/^\s*\n+\s*/g, '').replace(/\s*\n+\s*$/g, '');
				}
			});
		});

		document.querySelectorAll('.embed-media').forEach(wrap => {
			const cards = wrap.querySelectorAll('.embed-card');
			cards.forEach(card => {
				if (card.innerHTML.trim() === '') {
					card.remove();
				}
			});
		});
	}

	let toggleOpen = false;
	window.openToggle = () => {
		if (window.innerWidth >= 750) return;
		const list = document.getElementById('s');
		const right = document.getElementById('r');
		if (!list || !right) return;
		if (!toggleOpen) {
			list.style.display = 'none';
			right.style.display = 'flex';
		} else {
			list.style.display = 'block';
			right.style.display = 'none';
		}
		toggleOpen = !toggleOpen;
	};

	const search = document.getElementById('search');
	if (search) {
		search.addEventListener('input', e => {
			const term = e.target.value.toLowerCase();
			document.querySelectorAll('.chat-msg').forEach(msg => {
				const text = msg.innerText.toLowerCase();
				msg.style.display = text.includes(term) ? '' : 'none';
			});
		});
	}

	document.addEventListener('click', async e => {
		const btn = e.target.closest('.copy-id-pill, .copy-id');
		if (!btn) return;
		const id = btn.dataset.userId || btn.dataset.id || btn.textContent.trim();
		if (!id) return;
		e.stopPropagation();
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(id);
			} else {
				const ta = document.createElement('textarea');
				ta.value = id;
				ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				ta.remove();
			}
			btn.classList.add('copied');
			const orig = btn.textContent;
			btn.textContent = '✓ Copied';
			setTimeout(() => {
				btn.classList.remove('copied');
				btn.textContent = orig;
			}, 1200);
		} catch (err) {
			console.error('copy failed', err);
		}
	});

})();
