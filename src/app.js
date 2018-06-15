if (process.argv.length > 2 && process.argv[2] === "--interactive") {
    console.log("Entering interactive mode");
    global.IS_MOCK = true;
}

const Promise = require("bluebird");
const _ = require("lodash");
const MainBot = require("./main_bot");
const FilterBot = require("./filter_bot");
const FirehoseBot = require("./firehose_bot");
const FurAffinityClient = require("fa.js").FurAffinityClient;
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
const firehoseBot = new FirehoseBot(config.telegram.firehose_token);


// Wrap
if (global.IS_MOCK) {
    mainBot._mock_reply_handler((msg) => {
        console.log(`MAINBOT> ${JSON.stringify(msg)}`);
    });
    filterBot._mock_reply_handler((msg) => {
        console.log(`FILTERBOT> ${JSON.stringify(msg)}`);
    });
    firehoseBot._mock_reply_handler((msg) => {
        console.log(`FIREHOSE> ${JSON.stringify(msg)}`);
    });

    const itera = async () => {
        await mainBot._mock_simulate_message(config.telegram.mock_target_user, "/resetprogress");
        await firehoseBot._mock_simulate_message(config.telegram.mock_target_user, "/list");
    };

    itera().catch((err) => {
        console.log("ERR>", err);
    });
}


// FA check stuff
async function processUpdateAuto(user, key, key2, items, process_message) {
    let last_update = user[key] || [];
    if (!Array.isArray(last_update)) {
        last_update = [last_update];
    }

    if (!items || !items[key2]) return;
    items = items[key2];
    if (items.length < 1) return;

    const lastUpdateMapped = _.map(last_update, (id) => ({id}));
    // TODO: Remove 10 limit (only for testing)
    const between = _.chain(items).differenceBy(lastUpdateMapped, "id").take(10).value();

    await Promise.all(_.map(between, process_message));
    user[key] = _.map(items, "id");
}

async function processUserUpdate(user) {
    console.log("Checking for user", user.id);
    const fa = new FurAffinityClient(user.cookie);

    const submissions = await fa.getSubmissions();

    await processUpdateAuto(user, "last_update_sub", "submissions", submissions, async (item) => {
        const submission = await fa.getSubmission(item.id);
        const msgText = `Submission: <b>${escape(submission.title)}</b> by ${escape(submission.artist)}\n\n[ <a href="${submission.url}">Direct</a> | <a href="${item.url}">Link</a> ]\n\n${bodyText(submission.body_text, 200)}`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "__multi__", {"submission": submission.title, "submitter": submission.artist}, msgText);
        await firehoseBot.sendFirehoseMessage(user, submission.artist, msgText);
    });

    const messages = await fa.getMessages();

    await processUpdateAuto(user, "last_update_jou", "journals", messages, async (item) => {
        const msgText = `Journal: <b>${escape(item.title)}</b> by ${escape(item.user_name)}\n\n[ <a href="${item.url}">Link</a> ]`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "__multi__", {"journal": item.title, "submitter": item.user_name}, msgText);
        await firehoseBot.sendFirehoseMessage(user, item.user_name, msgText);
    });

    await processUpdateAuto(user, "last_update_com", "comments", messages, async (item) => {
        const msgText = `You received a comment from <b>${escape(item.user_name)}</b> on submission <a href="${item.url}">${escape(item.title)}</a>`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.title, msgText);
    });

    await processUpdateAuto(user, "last_update_watch", "watches", messages, async (item) => {
        const msgText = `You were watched by <a href="${item.user_url}">${escape(item.user_name)}</a>`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.user_name, msgText); // TODO: Use a different filter
    });

    await processUpdateAuto(user, "last_update_shout", "shouts", messages, async (item) => {
        const msgText = `You got <a href="${messages.self_user_url}">a shout</a> from <a href="${item.user_url}">${escape(item.user_name)}</a>`;

        await mainBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.user_name, msgText); // TODO: Use a different filter
    });

    const notes = await fa.getNotes();

    await processUpdateAuto(user, "last_update_note", "notes", notes, async (item) => {
        const msgText = `You received a note from <b>${escape(item.user_name)}</b> titled <a href="${item.url}">${escape(item.title)}</a>`;

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
