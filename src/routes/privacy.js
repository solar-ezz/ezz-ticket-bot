const { legalRoute } = require('../lib/legal');

module.exports.get = legalRoute('Privacy Policy', botName => `
	<p>This policy explains what data ${botName} (the "Bot") and its web dashboard collect, why they collect it, and what control you have over it. The Bot is a private ticket bot that runs only in the server it was built for.</p>

	<h2>1. Data we collect</h2>
	<ul>
		<li><strong>Discord account information:</strong> your user ID, username, display name, avatar and roles. This is collected when you open a ticket, take part in one, or use a Bot command.</li>
		<li><strong>Ticket content:</strong> messages sent in ticket channels (including edits and deletions), the names and links of attachments and embeds, answers to ticket questions, and ticket topics.</li>
		<li><strong>Ticket metadata:</strong> when tickets were opened, claimed and closed, who did each of those, and the reasons given.</li>
		<li><strong>Feedback:</strong> any rating and comment you submit after a ticket is closed.</li>
		<li><strong>Dashboard login:</strong> if you log in to the dashboard with Discord, the Bot receives your basic profile, your server list and your membership in this server. This is used only to check your access. A session cookie keeps you logged in.</li>
		<li><strong>Server logs:</strong> the web server records request details, including IP addresses, for security and debugging.</li>
	</ul>

	<h2>2. Why we use it</h2>
	<p>This data is used only to run the ticket system. That means creating and routing tickets, checking staff permissions, sending automatic replies, producing transcripts for staff, and showing staff support statistics. We do not sell your data or use it for advertising.</p>

	<h2>3. Message Content, Server Members and Presence</h2>
	<p>The Bot reads message content so it can store ticket transcripts and match automatic replies. It reads server member data so it can check staff roles and permissions, and so it can close tickets when their creator leaves. If presence data is enabled, it is used only to tell users when no staff are online. Presence data is never stored.</p>

	<h2>4. Storage and security</h2>
	<p>Ticket messages are stored encrypted in the Bot's database. Only the server's staff can see transcripts, through Discord or the dashboard.</p>

	<h2>5. Sharing</h2>
	<p>Data is not shared with third parties, with these exceptions:</p>
	<ul>
		<li><strong>Discord:</strong> data passes through Discord, because the Bot runs on Discord.</li>
		<li><strong>Anonymous statistics:</strong> aggregate, anonymised usage counts (for example, the number of tickets) may be sent to the developers of the open-source Discord Tickets software. These counts contain no message content and no personal identifiers.</li>
		<li><strong>Legal requirements:</strong> data may be disclosed where the law requires it.</li>
	</ul>

	<h2>6. Retention</h2>
	<p>Ticket data and transcripts are kept until staff delete them or you ask for them to be deleted. Session cookies expire automatically.</p>

	<h2>7. Your rights</h2>
	<p>You can ask for a copy of the data held about you, or ask for it to be deleted, by opening a ticket or contacting the server staff. Deletion may remove your messages from past ticket transcripts.</p>

	<h2>8. Children</h2>
	<p>The Bot is intended only for people who meet Discord's minimum age requirement.</p>

	<h2>9. Changes</h2>
	<p>This policy may be updated from time to time. The date at the top of this page shows when it last changed.</p>
`);
