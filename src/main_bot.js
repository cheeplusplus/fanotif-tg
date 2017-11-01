const NotifBot = require("./bot");


class MainBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/setfacookie (.+)/, (msg, match) => {
            return this.setFACookie(msg, match[1]);
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
}


module.exports = MainBot;
