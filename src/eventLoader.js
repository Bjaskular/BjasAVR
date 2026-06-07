const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { errorMiddleware } = require('./middleware/errorMiddleware');

function loadEvents(client) {
    const eventsPath = path.join(process.cwd(), 'src', 'events');

    if (!fs.existsSync(eventsPath)) {
        const errorMsg = `Events directory not found at ${eventsPath}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    logger.info('Loading global middleware for events...');

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        // TODO: In future, there might be more middleware types, so this should be refactored to support that.
        // Maybe like an array of middlewares in event definition
        // For now - YAGNI
        const safeExecute = errorMiddleware(event.execute, event.name);

        if (event.once === true) {
            client.once(event.name, async (...args) => {
                if (event.name === 'ready') {
                    setTimeout(async () => await safeExecute(...args), 2000);
                } else {
                    await safeExecute(...args);
                }
            });
        } else {
            client.on(event.name, async (...args) => await safeExecute(...args));
        }

        logger.info(`\t ↳ Event [${event.name}] has been auto secured.`);
    }
}

module.exports = { loadEvents };
