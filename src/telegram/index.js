if (global.IS_MOCK) {
    module.exports = require("./mock");
} else {
    module.exports = require("node-telegram-bot-api");
}
