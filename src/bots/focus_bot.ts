import * as AsyncLock from "async-lock";
import * as _ from "lodash";
import { NotifBot, Message } from "./bot";
import * as db from "../db";

export class FocusBot extends NotifBot {
    private _lock = new AsyncLock();

    _configure() {
        super._configure();

        this._onText(/^\/reset/, async (msg, match) => {
            return this._lock.acquire("userdb", () => this.resetUsers(msg));
        });

        this._onText(/^\/adduser(.+)*/, (msg, match) => {
            return this._lock.acquire("userdb", () => this.addUser(msg, match?.[1]));
        });

        this._onText(/^\/removeuser(.+)*/, (msg, match) => {
            return this._lock.acquire("userdb", () => this.removeUser(msg, match?.[1]));
        });

        this._onText(/^\/setusers([\s\S]+)*/, (msg, match) => {
            return this._lock.acquire("userdb", () => this.setUsers(msg, match?.[1]));
        });

        this._onText(/^\/list/, (msg, match) => {
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
        username = (username || "").trim().toLowerCase();
        if (!username || username.length < 2) {
            await this.sendMessage(user, `Invalid use of /adduser`);
            return;
        }

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
        username = (username || "").trim().toLowerCase();
        if (!username || username.length < 2) {
            await this.sendMessage(user, `Invalid use of /removeuser`);
            return;
        }

        if (_.includes(list, username)) {
            user.firehose_list = _.without(user.firehose_list, username);
            await db.updateUser(user);
            await this.sendMessage(user, `User <b>${username}</b> removed.`);
        } else {
            await this.sendMessage(user, `User <b>${username}</b> was not in the list.`);
        }

        await db.updateUser(user);
    }

    async setUsers(msg: Message, list: string | undefined) {
        const user = await db.getUserById(msg.chat.id);
        if (!list) {
            await this.sendMessage(user, `Invalid use of /setusers`);
            return;
        }

        const userList = _.chain(list)
            .split(/[\s\n,]+/)
            .filter(f => !!f)
            .map(m => m.trim().toLowerCase())
            .filter(f => f.length > 1)
            .value();

        if (userList.length < 1) {
            await this.sendMessage(user, `Set command got no entries`);
            return;
        }

        user.firehose_list = userList;
        await db.updateUser(user);
        await this.sendMessage(user, `Userlist set with ${userList.length} entries`);
    }

    async getUsers(msg: Message) {
        const user = await db.getUserById(msg.chat.id);
        const list = user.firehose_list || [];

        if (list.length === 0) {
            await this.sendMessage(user, "You aren't following any users.");
        } else {
            const listLi = list.map((m) => `* ${m}`).join("\n");
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
