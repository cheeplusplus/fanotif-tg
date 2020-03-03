import * as _ from "lodash";
import { NotifBot, Message } from "./bot";
import * as db from "../db";

export class FocusBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/reset/, (msg, match) => {
            return this.resetUsers(msg);
        });

        this._onText(/\/adduser(.+)*/, (msg, match) => {
            return this.addUser(msg, match?.[1]);
        });

        this._onText(/\/removeuser(.+)*/, (msg, match) => {
            return this.removeUser(msg, match?.[1]);
        });

        this._onText(/\/list/, (msg, match) => {
            return this.getUsers(msg);
        });
    }

    async resetUsers(msg: Message) {
        const user = await db.getUserById(msg.chat.id);
        user.firehose_list = [];
        await db.updateUser(user);
    }

    async addUser(msg: Message, username: string | undefined) {
        const user = await db.getUserById(msg.chat.id);
        const list = user.firehose_list || [];
        if (!username) return;
        username = username.trim().toLowerCase();
        if (!username) return;

        if (!_.includes(list, username)) {
            list.push(username);
            user.firehose_list = list;
            await db.updateUser(user);
            await this.sendMessage(user, `User <b>${username}</b> added.`);
        } else {
            await this.sendMessage(user, `User <b>${username}</b> was already added.`);
        }
    }

    async removeUser(msg: Message, username: string | undefined) {
        const user = await db.getUserById(msg.chat.id);
        const list = user.firehose_list || [];
        if (!username) return;
        username = username.trim().toLowerCase();
        if (!username) return;

        if (_.includes(list, username)) {
            user.firehose_list = _.without(username);
            await db.updateUser(user);
            await this.sendMessage(user, `User <b>${username}</b> removed.`);
        } else {
            await this.sendMessage(user, `User <b>${username}</b> was not in the list.`);
        }

        await db.updateUser(user);
        await this.sendMessage(user, `User <b>${username}</b> removed.`);
    }

    async getUsers(msg: Message) {
        const user = await db.getUserById(msg.chat.id);
        const list = user.firehose_list || [];

        if (list.length === 0) {
            await this.sendMessage(user, "You aren't following any users.");
        } else {
            const listLi = list.map((m) => `* ${m}\n`);
            await this.sendMessage(user, `You are following these users:\n\n${listLi}`);
        }
    }

    sendFirehoseMessage(user: db.UserRow, username: string, message: string) {
        const list = user.firehose_list || [];

        if (_.includes(list, username.trim().toLowerCase())) {
            return this.sendMessage(user, message);
        }
    }
}
