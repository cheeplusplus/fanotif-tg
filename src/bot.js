const TelegramBot = require("./telegram");
const db = require("./db");


class NotifBot {
    constructor(token) {
        this.db = db;
        this.bot = new TelegramBot(token, {"polling": true});
        this._configure();
    }

    _configure() {
        this._onText(/\/start/, (msg, match) => {
            return this.onStart(msg);
        });
    }

    _onText(regex, callback) {
        return this.bot.onText(regex, (msg, match) => {
            Promise.resolve(callback(msg, match)).then().catch((err) => {
                console.warn("Bot error", err);
            });
        });
    }

    async onStart(msg) {
        const chatId = msg.chat.id;
        const user = await this.db.getUserById(chatId);

        await this.bot.sendMessage(chatId, `Hello, ${chatId}. ${JSON.stringify(user)}`);
    }

    async sendMessage(user, message) {
        const chatId = user.id;
        await this.bot.sendMessage(chatId, message, {"parse_mode": "HTML"});
    }

    _mock_simulate_message(chatId, text) {
        return this.bot._mock_simulate_message(chatId, text);
    }

    _mock_reply_handler(callback) {
        return this.bot._mock_reply_handler(callback);
    }
}


module.exports = NotifBot;
