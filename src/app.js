const Promise = require("bluebird");
const _ = require("lodash");
const MainBot = require("./main_bot");
const FilterBot = require("./filter_bot");
const FurAffinityClient = require("./fa");
const db = require("./db");
const escape = require("escape-html");


// Variables
const TIMEOUT = 60*1000;

function limit(str, size=500) {
    if (!str) return "";
    let s = str.substr(0, size);
    if (s.length === size) {
        s += "...";
    }

    return s;
}

function bodyText(str, size) {
    return escape(limit(str, size));
}

// Load config
const config = require("../config.json");


// Init bot
const mainBot = new MainBot(config.telegram.main_token);
const filterBot = new FilterBot(config.telegram.filter_token);


// FA check stuff
async function processUpdateAuto(user, key, key2, items, process_message) {
    const last_update = user[key] || 0;
    if (!items || !items[key2]) return;
    items = items[key2];
    if (items.length < 1) return;

    const top = _.head(items);
    if (top.id <= last_update) {
        return;
    }

    // TODO: Remove 10 limit (only for testing)
    const between = _.chain(items).filter((f) => f.id > last_update).take(10).value();

    await Promise.all(_.map(between, process_message));
    user[key] = top.id;
}

async function processUserUpdate(user) {
    console.log("Checking for user", user.id);
    const fa = new FurAffinityClient(user.cookie);

    const submissions = await fa.getSubmissions();

    await processUpdateAuto(user, "last_update_sub", "submissions", submissions, async (item) => {
        const submission = await fa.getSubmission(item.id);
        const msgText = `Submission: <b>${escape(submission.title)}</b> by ${submission.artist}\n\n[ <a href="${submission.url}">Direct</a> | <a href="${item.url}">Link</a> ]\n\n${bodyText(submission.body_text, 200)}`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "submission", submission.title, msgText);
    });

    const messages = await fa.getMessages();

    await processUpdateAuto(user, "last_update_jou", "journals", messages, async (item) => {
        const msgText = `Journal: <b>${escape(item.title)}</b> by ${item.user_name}\n\n[ <a href="${item.url}">Link</a> ]`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "journal", item.title, msgText);
    });

    await processUpdateAuto(user, "last_update_com", "comments", messages, async (item) => {
        const msgText = `You received a comment from <b>${item.user_name}</b> on submission <a href="${item.url}">${escape(item.title)}</a>`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.title, msgText);
    });

    await processUpdateAuto(user, "last_update_watch", "watches", messages, async (item) => {
        const msgText = `You were watched by <a href="${item.user_url}">${item.user_name}</a>`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.user_name, msgText); // TODO: Use a different filter
    });

    const notes = await fa.getNotes();

    await processUpdateAuto(user, "last_update_note", "notes", notes, async (item) => {
        const msgText = `You received a note from <b>${item.user_name}</b> titled <a href="${item.url}">${escape(item.title)}</a>`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.title, msgText); // TODO: Use a different filter
    });

    await db.updateUser(user);
    await db.save();
}

async function processUpdates() {
    console.log("Checking FA for updates...");

    const users = await db.getAllConfiguredUsers();
    await Promise.all(_.map(users, processUserUpdate));

    console.log(`Sleeping for ${TIMEOUT / 1000} seconds`);
}

function processUpdatesOuter() {
    processUpdates().catch((err) => {
        console.warn("Got error", err);
    });
}

// Start checking for FA updates
processUpdatesOuter();
setInterval(processUpdatesOuter, TIMEOUT);
