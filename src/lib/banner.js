/* eslint-disable no-console */
const { colours } = require('leeks.js');
const figlet = require('figlet');
const link = require('terminal-link');

module.exports = version => {
	figlet
		.textSync('Ezz', { font: 'Banner3' })
		.split('\n')
		.forEach(line => console.log(colours.cyan(line)));
	console.log('');
	figlet
		.textSync('Tickets', { font: 'Banner3' })
		.split('\n')
		.forEach(line => console.log(colours.cyan(line)));
	console.log('');
	console.log(colours.cyanBright(`${link('Ezz Tickets', 'https://discordtickets.app')} bot v${version} by Ezz`));
	console.log(colours.cyanBright('Sponsor this project at https://discordtickets.app/sponsor'));
	console.log('\n');
};
