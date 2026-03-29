(() => {
	
	window.addEventListener('load', () => {
		const loader = document.getElementById('loader');
		if (loader) loader.remove();
	});

	
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
})();

