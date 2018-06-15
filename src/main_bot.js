const NotifBot = require("./bot");


class MainBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/setfacookie (.+)/, (msg, match) => {
            return this.setFACookie(msg, match[1]);
        });

        this._onText(/\/resetprogress/, (msg, match) => {
            return this.resetProgress(msg);
        });
    }

    async setFACookie(msg, cookie) {
        const chatId = msg.chat.id;
        const user = await this.db.getUserById(chatId);

        if (cookie.trim() === "") {
            await this.bot.sendMessage(chatId, "Invalid FA cookie specified.");
            return;
        }

        user.cookie = cookie;
        await this.db.updateUser(user);
        await this.bot.sendMessage(chatId, "Your FA cookie has been updated.");
    }

    async resetProgress(msg) {
        const chatId = msg.chat.id;
        const user = await this.db.getUserById(chatId);

        user.last_update_sub = [];
        user.last_update_jou = [];
        user.last_update_com = [];
        user.last_update_watch = [];
        user.last_update_shout = [];
        user.last_update_note = [];

        await this.db.updateUser(user);
        await this.bot.sendMessage(chatId, "Your progress has been reset.");
    }
}


module.exports = MainBot;
