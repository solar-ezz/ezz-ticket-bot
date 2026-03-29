(() => {

	window.addEventListener('load', () => {
		const loader = document.getElementById('loader');
		if (loader) loader.remove();
		fixAvatars();
		removeDuplicateMedia();
	});

	function removeDuplicateMedia() {
		document.querySelectorAll('.chat-msg').forEach(msg => {
			// Remove big inline-media videos when an embed video already exists for the same source
			const inlineVideos = Array.from(msg.querySelectorAll('video.inline-media'));
			inlineVideos.forEach(inlineVid => {
				const inlineSrc = (inlineVid.src || inlineVid.querySelector('source')?.src || '').split('?')[0];
				const embedVideos = Array.from(msg.querySelectorAll('video:not(.inline-media)'));
				const isDupe = embedVideos.some(ev => {
					const evSrc = (ev.src || ev.querySelector('source')?.src || '').split('?')[0];
					// Compare by filename without extension to handle mp4 vs webm differences
					const inlineFile = inlineSrc.split('/').pop().replace(/\.[^.]+$/, '');
					const embedFile = evSrc.split('/').pop().replace(/\.[^.]+$/, '');
					return inlineFile && embedFile && (inlineFile === embedFile || inlineSrc === evSrc);
				});
				if (isDupe) {
					const parent = inlineVid.parentElement;
					if (parent && parent !== msg && (parent.tagName === 'A' || parent.classList.contains('embed-media'))) {
						parent.remove();
					} else {
						inlineVid.remove();
					}
				}
			});

			// Same deduplication for inline-media images
			const inlineImgs = Array.from(msg.querySelectorAll('img.inline-media'));
			inlineImgs.forEach(inlineImg => {
				const inlineSrc = inlineImg.src.split('?')[0];
				const embedImgs = Array.from(msg.querySelectorAll('img:not(.inline-media):not(.avatar)'));
				const isDupe = embedImgs.some(ei => ei.src.split('?')[0] === inlineSrc);
				if (isDupe) inlineImg.remove();
			});
		});
	}

	function fixAvatars() {
		document.querySelectorAll('img.avatar').forEach(img => {
			const fallback = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2242%22 height%3D%2242%22 viewBox%3D%220 0 42 42%22%3E%3Ccircle cx%3D%2221%22 cy%3D%2221%22 r%3D%2221%22 fill%3D%22%23222631%22/%3E%3Ccircle cx%3D%2221%22 cy%3D%2216%22 r%3D%228%22 fill%3D%22%23a7abb5%22/%3E%3Cellipse cx%3D%2221%22 cy%3D%2236%22 rx%3D%2213%22 ry%3D%229%22 fill%3D%22%23a7abb5%22/%3E%3C/svg%3E';
			img.addEventListener('error', function () {
				if (this.src !== fallback) {
					this.src = fallback;
				}
			});
			if (img.complete && img.naturalWidth === 0) {
				img.src = fallback;
			}
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
		const btn = e.target.closest('.copy-id-pill');
		if (!btn) return;
		e.stopPropagation();
		const id = btn.dataset.userId;
		if (!id) return;
		const original = btn.textContent;
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
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
