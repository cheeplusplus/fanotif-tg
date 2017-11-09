const _ = require("lodash");
const NotifBot = require("./bot");


class FilterBot extends NotifBot {
    _configure() {
        super._configure();

        this._onText(/\/setsubmissionfilter(.+)*/, (msg, match) => {
            return this.setSubmissionFilter(msg, match[1]);
        });

        this._onText(/\/setjournalfilter(.+)*/, (msg, match) => {
            return this.setJournalFilter(msg, match[1]);
        });

        this._onText(/\/togglecomments/, (msg, match) => {
            return this.toggleComments(msg);
        });

        this._onText(/\/filters/, (msg, match) => {
            return this.getFilters(msg);
        });
    }

    async _setFilter(user, type, filter) {
        if (!filter || filter.trim() === "") {
            filter = null;
        } else {
            filter = filter.trim();
        }

        try {
            new RegExp(filter);
        } catch (err) {
            return this.sendMessage(user, `Got error parsing filter: <code>${escape(err.message)}</code>`);
        }

        const filters = user.filters || {};
        filters[type] = filter;
        user.filters = filters;
        await this.db.updateUser(user);

        if (filter) {
            return this.sendMessage(user, `Set <b>${type}</b> filter to <code>${filter}</code>`);
        } else {
            return this.sendMessage(user, `Unset <b>${type}</b> filter`);
        }
    }

    async setSubmissionFilter(msg, filter) {
        const user = await this.db.getUserById(msg.chat.id);
        return this._setFilter(user, "submission", filter);
    }

    async setJournalFilter(msg, filter) {
        const user = await this.db.getUserById(msg.chat.id);
        return this._setFilter(user, "journal", filter);
    }

    async toggleComments(msg) {
        const user = await this.db.getUserById(msg.chat.id);
        const currentState = !!user.filterComments;
        user.filterComments = !currentState;
        await this.db.updateUser(user);

        if (user.filterComments) {
            return this.sendMessage(user, "Now sending comments to this bot");
        } else {
            return this.sendMessage(user, "No longer sending comments to this bot");
        }
    }

    async getFilters(msg) {
        const user = await this.db.getUserById(msg.chat.id);
        return this.sendMessage(user, `Filters: <code>${JSON.stringify(user.filters)}</code>\nComments: <code>${user.filterComments}</code>`);
    }

    sendFilteredMessage(user, type, filterContent, message) {
        let matchesFilter = false;
        if (!Array.isArray(filterContent)) {
            filterContent = [filterContent];
        }

        if (type === "comment") {
            matchesFilter = !!user.filterComments;
        } else {
            const filters = user.filters || {};
            const thisFilter = filters[type];
            if (!thisFilter) {
                return null;
            }

            const thisFilterRegex = new RegExp(thisFilter, "i");

            matchesFilter = _.some(filterContent, (fc) => {
                const matchTest = thisFilterRegex.exec(fc);
                const isMatch = matchTest !== null;
                // console.log(`Testing '${fc}' on '${thisFilter}': ${isMatch}`);
                return isMatch;
            });
        }

        if (matchesFilter) {
            return this.sendMessage(user, message);
        }
    }
}


module.exports = FilterBot;
