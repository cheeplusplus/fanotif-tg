import * as _ from "lodash";
import { NotifBot, Message } from "./bot";
import * as db from "../db";

export class FilterBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/reset/, (msg, match) => {
            return this._resetFilters(msg);
        });

        this._onText(/\/setsubmissionfilter(.+)*/, (msg, match) => {
            return this.setSubmissionFilter(msg, match?.[1]);
        });

        this._onText(/\/setjournalfilter(.+)*/, (msg, match) => {
            return this.setJournalFilter(msg, match?.[1]);
        });

        this._onText(/\/togglecomments/, (msg, match) => {
            return this.toggleComments(msg);
        });

        this._onText(/\/filters/, (msg, match) => {
            return this.getFilters(msg);
        });
    }

    async _setFilter(user: db.UserRow, type: string, filter: string | undefined | null) {
        if (!filter || filter.trim() === "") {
            filter = null;
        } else {
            filter = filter.trim();
        }

        if (filter) {
            try {
                const result = new RegExp(filter);
            } catch (err) {
                return this.sendMessage(user, `Got error parsing filter: <code>${escape(err.message)}</code>`);
            }
        }

        const filters = user.filters || {};
        filters[type] = filter;
        user.filters = filters;
        await db.updateUser(user);

        if (filter) {
            return this.sendMessage(user, `Set <b>${type}</b> filter to <code>${filter}</code>`);
        } else {
            return this.sendMessage(user, `Unset <b>${type}</b> filter`);
        }
    }

    async _resetFilters(msg: Message) {
        const user = await db.getUserById(msg.chat.id);
        user.filters = {};
        await db.updateUser(user);
    }

    async setSubmissionFilter(msg: Message, filter: string | undefined) {
        const user = await db.getUserById(msg.chat.id);
        return this._setFilter(user, "submission", filter);
    }

    async setJournalFilter(msg: Message, filter: string | undefined) {
        const user = await db.getUserById(msg.chat.id);
        return this._setFilter(user, "journal", filter);
    }

    async toggleComments(msg: Message) {
        const user = await db.getUserById(msg.chat.id);
        const currentState = !!user.filterComments;
        user.filterComments = !currentState;
        await db.updateUser(user);

        if (user.filterComments) {
            return this.sendMessage(user, "Now sending comments to this bot");
        } else {
            return this.sendMessage(user, "No longer sending comments to this bot");
        }
    }

    async getFilters(msg: Message) {
        const user = await db.getUserById(msg.chat.id);
        return this.sendMessage(user, `Filters: <code>${JSON.stringify(user.filters)}</code>\nComments: <code>${user.filterComments}</code>`);
    }

    async sendFilteredMessage(user: db.UserRow, type: "__multi__" | "comment", username: string, filterContent: string | { [filterType: string]: string }, message: string) {
        let matchesFilter = false;

        if (type === "comment") {
            matchesFilter = !!user.filterComments;
        } else {
            const filters = user.filters || {};

            let matchMode: { [filterType: string]: string };
            if (type === "__multi__" && typeof filterContent === "object") {
                matchMode = filterContent;
            } else if (typeof filterContent === "string") {
                matchMode = { [type]: filterContent };
            } else {
                return this.sendMessage(user, "Error: Unable to process filter configuration");
            }

            matchesFilter = _.some(matchMode, (v, k) => {
                const thisFilter = filters[k];
                if (!thisFilter) {
                    return false;
                }
                return FilterBot.testFilter(thisFilter, v);
            });
        }

        if (matchesFilter) {
            await this.sendMessage(user, message, this.shouldNotify(username));
            this.didNotify(username);
        }
    }

    static testFilter(filterText: string, testContent: string) {
        const thisFilterRegex = new RegExp(filterText, "i");

        return _.some(_.castArray(testContent), (fc) => {
            const matchTest = thisFilterRegex.exec(fc);
            const isMatch = matchTest !== null;
            // console.log(`Testing '${fc}' on '${thisFilter}': ${isMatch}`);
            return isMatch;
        });
    }
}
