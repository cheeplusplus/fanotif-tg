const Promise = require("bluebird");
const _ = require("lodash");
const NotifBot = require("./bot");
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
const bot = new NotifBot(config.telegram.token);


// FA check stuff
async function processUpdateAuto(user, key, key2, fetch_all, process_message) {
    const last_update = user[key] || 0;
    let items = await fetch_all();
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

    await processUpdateAuto(user, "last_update_sub", "submissions", () => fa.getSubmissions(), async (item) => {
        const submission = await fa.getSubmission(item.id);
        await bot.sendMessage(user, `Submission: <b>${submission.title}</b> by ${submission.artist}\n\n[ <a href="${submission.url}">Direct</a> | <a href="${item.url}">Link</a> ]\n\n${bodyText(submission.body_text, 200)}`);
    });

    await processUpdateAuto(user, "last_update_jou", "journals", () => fa.getMessages(), (item) => {
        return bot.sendMessage(user, `Journal: <b>${item.title}</b> by ${item.user_name}\n\n[ <a href="${item.url}">Link</a> ]`);
    });

    db.updateUser(user);
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
