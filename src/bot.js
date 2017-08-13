const TelegramBot = require("node-telegram-bot-api");
const db = require("./db");


class NotifBot {
    constructor(token) {
        this.bot = new TelegramBot(token, {"polling": true});
        this._configure();
    }

    _configure() {
        this._onText(/\/start/, (msg, match) => {
            return this.onStart(msg);
        });

        this._onText(/\/setfacookie (.+)/, (msg, match) => {
            return this.setFACookie(msg, match[1]);
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
        const user = await db.getUserById(chatId);

        await this.bot.sendMessage(chatId, `Hello, ${chatId}. ${JSON.stringify(user)}`);
    }

    async setFACookie(msg, cookie) {
        const chatId = msg.chat.id;
        const user = await db.getUserById(chatId);

        if (cookie.trim() === "") {
            await this.bot.sendMessage(chatId, "Invalid FA cookie specified.");
            return;
        }

        user.cookie = cookie;
        await db.updateUser(user);
        await this.bot.sendMessage(chatId, "Your FA cookie has been updated.");
    }

    async sendMessage(user, message) {
        const chatId = user.id;
        await this.bot.sendMessage(chatId, message, {"parse_mode": "HTML"});
    }
}


module.exports = NotifBot;
