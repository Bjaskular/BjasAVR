const {userLocks} = require('./state');

function withUserLock(userId, callback) {
    const prev = userLocks.get(userId) ?? Promise.resolve();
    const next = prev
        .catch(() => {})
        .then(() => callback())
        .catch(err => {
            console.error(err);
            throw err;
        });

    userLocks.set(userId, next);

    return next.finally(() => {
        if (userLocks.get(userId) === next) {
            userLocks.delete(userId);
        }
    });
}

module.exports = { withUserLock };
