(() => {

	window.addEventListener('load', () => {
		const loader = document.getElementById('loader');
		if (loader) loader.remove();
		fixAvatars();
		removeDuplicateMedia();
	});

	// Removes the large inline-media video/image when a smaller embed version
	// of the same media already exists in the same message.
	function removeDuplicateMedia() {
		document.querySelectorAll('.chat-msg').forEach(msg => {
			const body = msg.querySelector('.body');
			if (!body) return;

			// --- Videos ---
			const inlineVids = Array.from(body.querySelectorAll('video.inline-media'));
			const embedVids  = Array.from(body.querySelectorAll('video:not(.inline-media)'));

			inlineVids.forEach(iv => {
				// Grab the src from the element or its first <source> child
				const getSrc = el => (el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || '');
				const ivBase = getSrc(iv).split('?')[0].replace(/\.[^/.]+$/, ''); // strip query + extension

				const isDupe = embedVids.some(ev => {
					const evBase = getSrc(ev).split('?')[0].replace(/\.[^/.]+$/, '');
					return ivBase && evBase && ivBase === evBase;
				});

				if (isDupe) iv.remove();
			});

			// --- Images ---
			const inlineImgs = Array.from(body.querySelectorAll('img.inline-media'));
			const embedImgs  = Array.from(body.querySelectorAll('img:not(.inline-media):not(.avatar)'));

			inlineImgs.forEach(ii => {
				const iiSrc = ii.getAttribute('src')?.split('?')[0] || '';
				const isDupe = embedImgs.some(ei => (ei.getAttribute('src')?.split('?')[0] || '') === iiSrc);
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
				msg.style.display = msg.innerText.toLowerCase().includes(term) ? '' : 'none';
			});
		});
	}

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
			btn.textContent = '✓';
			setTimeout(() => {
				btn.classList.remove('copied');
				btn.textContent = original;
			}, 1200);
		} catch (err) {
			console.error('copy failed', err);
		}
	});

})();
