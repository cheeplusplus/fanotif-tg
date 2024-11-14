import { NotifBot, Message } from "./bot";
import * as db from "../db";

export class FirehoseBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/setfacookie (.+)/, (msg, match) => {
            return this.setFACookie(msg, match?.[1]);
        });

        this._onText(/\/resetprogress/, (msg, match) => {
            return this.resetProgress(msg);
        });
    }

    async setFACookie(msg: Message, cookie: string | undefined) {
        const chatId = msg.chat.id;
        const user = await db.getUserById(chatId);

        if (!cookie || cookie.trim() === "") {
            await this.sendMessage(chatId, "Invalid FA cookie specified.");
            return;
        }

        user.cookie = cookie;
        await db.updateUser(user);
        await this.sendMessage(chatId, "Your FA cookie has been updated.");
    }

    async resetProgress(msg: Message) {
        const chatId = msg.chat.id;
        const user = await db.getUserById(chatId);

        user.last_update_sub = [];
        user.last_update_jou = [];
        user.last_update_com = [];
        user.last_update_watch = [];
        user.last_update_shout = [];
        user.last_update_note = [];

        await db.updateUser(user);
        await this.sendMessage(chatId, "Your progress has been reset.");
    }

    async sendFirehoseMessage(user: db.UserRow, username: string, message: string) {
        await this.sendMessage(user, message, this.shouldNotify(username));
        this.didNotify(username);
    }
}
