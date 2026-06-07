const logger = require('../logger');

function errorMiddleware(fn, name = 'Async Function') {
    return async function (...args) {
        try {
            return await fn(...args);
        } catch (err) {
            let summary = 'No details input data';

            if (args[0] !== undefined && args[0].user !== undefined) {
                summary = `User: ${args[0].user.tag} (${args[0].user.id})`;
            } else if (typeof args[0] === 'string') {
                summary = `ID: ${args[0]}`;
            }

            logger.error(`[Errors Layer] Breakdown in module: ${name} `);
            logger.error(`\t ↳ INPUT: ${summary}`);
            logger.error(`\t ↳ OUTPUT: ${err.message}`);

            console.error(err);
        }
    }
}

module.exports = { errorMiddleware };
