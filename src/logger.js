const COLORS = {
    reset: "\x1b[0m",
    info: "\x1b[36m",
    success: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    lock: "\x1b[35m",
};

function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
    info(message) {
        console.log(`${COLORS.info}[${getTimestamp()}] [INFO] ${message}${COLORS.reset}`);
    },

    success(message) {
        console.log(`${COLORS.success}[${getTimestamp()}] [SUCCESS] ${message}${COLORS.reset}`);
    },

    warn(message) {
        console.log(`${COLORS.warn}[${getTimestamp()}] [WARN] ${message}${COLORS.reset}`);
    },

    error(message, errorObj = '') {
        console.error(`${COLORS.error}[${getTimestamp()}] [ERROR] ${message}${COLORS.reset}`, errorObj);
    },

    lock(message) {
        console.log(`${COLORS.lock}[${getTimestamp()}] [LOCK] ${message}${COLORS.reset}`);
    },
};

module.exports = logger;