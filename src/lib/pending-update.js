const { execSync } = require('child_process');
const {
	existsSync, rmSync, writeFileSync,
} = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '../..');
const MARKER = join(ROOT, '.update-pending');

const markPending = () => writeFileSync(MARKER, String(Date.now()));

const finishPendingUpdate = log => {
	if (!existsSync(MARKER)) return;
	log('Finishing update: preparing the database…');
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
	try {
		execSync(`"${process.execPath}" scripts/postinstall`, {
			cwd: ROOT,
			env: process.env,
			stdio: 'inherit',
			timeout: 300000,
		});
		rmSync(MARKER, { force: true });
		log('Update finished.');
	} catch (error) {
		log(`Could not finish the update automatically: ${error.message}. Stop the bot and run "npm install" in its folder.`);
	}
};

module.exports = {
	finishPendingUpdate,
	markPending,
};
