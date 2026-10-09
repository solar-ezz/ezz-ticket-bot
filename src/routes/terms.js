const { legalRoute } = require('../lib/legal');

module.exports.get = legalRoute('Terms of Service', botName => `
	<p>These terms apply to your use of ${botName} (the "Bot"), a private ticket and support bot that runs only in the server it was built for, and to its web dashboard. By using the Bot or the dashboard you agree to these terms.</p>

	<h2>1. The service</h2>
	<p>The Bot lets members open support tickets, lets staff manage them, and keeps transcripts of closed tickets. It is a private bot and cannot be added to other servers.</p>

	<h2>2. Your responsibilities</h2>
	<ul>
		<li>You must follow the <a href="https://discord.com/terms">Discord Terms of Service</a> and <a href="https://discord.com/guidelines">Community Guidelines</a>, as well as the rules of the server.</li>
		<li>Do not use the Bot to send spam, harassment, illegal content or malware, and do not use it to impersonate anyone.</li>
		<li>Do not try to abuse, overload, reverse-engineer or get around the Bot's permission checks, or the dashboard's.</li>
	</ul>

	<h2>3. Ticket content</h2>
	<p>Messages you send in ticket channels are recorded so that staff can review them in transcripts. Do not share passwords, payment details or other sensitive information in tickets. The <a href="/privacy">Privacy Policy</a> explains what is stored and how to request deletion.</p>

	<h2>4. Moderation</h2>
	<p>Server staff may close tickets, and may restrict or remove your access to the Bot at any time, especially if you break these terms.</p>

	<h2>5. Availability and warranty</h2>
	<p>The Bot is provided "as is", with no guarantee of uptime or availability, and without any warranty. Features may change or be removed at any time.</p>

	<h2>6. Limitation of liability</h2>
	<p>To the extent permitted by law, the operators of the Bot are not liable for any loss or damage resulting from your use of the Bot or the dashboard, or from being unable to use them.</p>

	<h2>7. Changes</h2>
	<p>These terms may be updated from time to time. The date at the top of this page shows when they last changed. If you keep using the Bot after a change, you accept the new terms.</p>

	<h2>8. Contact</h2>
	<p>If you have a question about these terms, open a ticket or contact the server staff.</p>
`);
