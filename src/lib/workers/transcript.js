const { expose } = require('threads/worker');
const { decrypt } = require('../crypto');

function getTranscript(ticket) {
	ticket.claimedBy = ticket.archivedUsers.find(u => u.userId === ticket.claimedById);
	ticket.closedBy = ticket.archivedUsers.find(u => u.userId === ticket.closedById);
	ticket.createdBy = ticket.archivedUsers.find(u => u.userId === ticket.createdById);

	if (ticket.closedReason) ticket.closedReason = decrypt(ticket.closedReason);
	if (ticket.feedback?.comment) ticket.feedback.comment = decrypt(ticket.feedback.comment);
	if (ticket.topic) ticket.topic = decrypt(ticket.topic).replace(/\n/g, '\n\t');

	ticket.archivedUsers.forEach((user, i) => {
		if (user.displayName) user.displayName = decrypt(user.displayName);
		user.username = decrypt(user.username);
		if (user.avatar?.startsWith?.('http')) user.proxyAvatar = user.avatar;
		ticket.archivedUsers[i] = user;
	});

	ticket.archivedMessages.forEach((message, i) => {
		message.author = ticket.archivedUsers.find(u => u.userId === message.authorId);
		message.content = JSON.parse(decrypt(message.content));
		message.text = message.content.content?.replace(/\n/g, '\n\t') ?? '';
		message.reactions = Array.isArray(message.content?.reactions)
			? message.content.reactions.map(r => ({
				name: r.emoji?.name || r.emoji?.id || '',
				id: r.emoji?.id || null,
				animated: Boolean(r.emoji?.animated),
				count: r.count || 0,
			}))
			: [];
		message.number = 'M' + String(i + 1).padStart(ticket.archivedMessages.length.toString().length, '0');
		ticket.archivedMessages[i] = message;
	});

	ticket.questionAnswers = ticket.questionAnswers.map(answer => {
		answer.value &&= decrypt(answer.value);
		return answer;
	});

	ticket.pinnedMessageIds = ticket.pinnedMessageIds.map(id => ticket.archivedMessages.find(message => message.id === id)?.number);

	return ticket;
}

expose(getTranscript);


