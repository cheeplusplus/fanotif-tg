const _ = require("lodash");
const NotifBot = require("./bot");


class FocusBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/reset/, (msg, match) => {
            return this.resetUsers(msg);
        });

        this._onText(/\/adduser(.+)*/, (msg, match) => {
            return this.addUser(msg, match[1]);
        });

        this._onText(/\/removeuser(.+)*/, (msg, match) => {
            return this.removeUser(msg, match[1]);
        });

        this._onText(/\/list/, (msg, match) => {
            return this.getUsers(msg);
        });
    }

    async resetUsers(msg) {
        const user = await this.db.getUserById(msg.chat.id);
        user.firehose_list = [];
        await this.db.updateUser(user);
    }

    async addUser(msg, username) {
        const user = await this.db.getUserById(msg.chat.id);
        let list = user.firehose_list || [];
        username = username.trim().toLowerCase();

        if (!_.includes(list, username)) {
            list.push(username);
            user.firehose_list = list;
            await this.db.updateUser(user);
            await this.sendMessage(user, `User <b>${username}</b> added.`);
        } else {
            await this.sendMessage(user, `User <b>${username}</b> was already added.`);
        }
    }

    async removeUser(msg, username) {
        const user = await this.db.getUserById(msg.chat.id);
        const list = user.firehose_list || [];
        username = username.trim().toLowerCase();

        if (_.includes(list, username)) {
            user.firehose_list = _.without(username);
            await this.db.updateUser(user);
            await this.sendMessage(user, `User <b>${username}</b> removed.`);
        } else {
            await this.sendMessage(user, `User <b>${username}</b> was not in the list.`);
        }

        await this.db.updateUser(user);
        await this.sendMessage(user, `User <b>${username}</b> removed.`);
    }

    async getUsers(msg) {
        const user = await this.db.getUserById(msg.chat.id);
        const list = user.firehose_list || [];

        if (list.length === 0) {
            await this.sendMessage(user, "You aren't following any users.");
        } else {
            const listLi = list.map((m) => `* ${m}\n`);
            await this.sendMessage(user, `You are following these users:\n\n${listLi}`);
        }
    }

    sendFirehoseMessage(user, username, message) {
        const list = user.firehose_list || [];

        if (_.includes(list, username.trim().toLowerCase())) {
            return this.sendMessage(user, message);
        }
    }
}


module.exports = FocusBot;
