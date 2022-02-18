import "source-map-support/register";

let IS_MOCK = false;

if (process.env.IS_MOCK || process.argv.length > 2 && process.argv[2] === "--interactive") {
    console.log("Entering interactive mode");
    process.env.IS_MOCK = "true";
    IS_MOCK = true;
}

import * as _ from "lodash";
import { FirehoseBot, FilterBot, FocusBot } from "./bots";
import { FurAffinityClient } from "fa.js";
import * as db from "./db";
import escape = require("escape-html");

// Variables
const TIMEOUT = 60 * 1000;

function limit(str: string, size: number = 500) {
    if (!str) return "";
    let s = str.substring(0, size);
    if (s.length === size) {
        s += "...";
    }

    return s;
}

function bodyText(str: string, size: number) {
    return escape(limit(str, size));
}

// Load config
// tslint:disable-next-line: no-var-requires
const config = require("../config.json") as {
    telegram: {
        mock_target_user?: string;
        firehose_token: string;
        filter_token: string;
        focus_token: string;
    }
};


// Init bot
const firehoseBot = new FirehoseBot(config.telegram.firehose_token);
const filterBot = new FilterBot(config.telegram.filter_token);
const focusBot = new FocusBot(config.telegram.focus_token);


// Wrap
if (IS_MOCK) {
    firehoseBot._mock_reply_handler((msg) => {
        console.log(`FIREHOSE> ${JSON.stringify(msg)}`);
    });
    filterBot._mock_reply_handler((msg) => {
        console.log(`FILTERED> ${JSON.stringify(msg)}`);
    });
    focusBot._mock_reply_handler((msg) => {
        console.log(`FOCUSED> ${JSON.stringify(msg)}`);
    });

    const itera = async () => {
        if (!config.telegram.mock_target_user) {
            return;
        }

        focusBot._mock_simulate_message(config.telegram.mock_target_user, `/setusers andrewneo,kauko`);
        focusBot._mock_simulate_message(config.telegram.mock_target_user, "/list");
    };

    itera().catch((err) => {
        console.log("ERR>", err);
    });
}

function makeUrl(url: string) {
    if (url.startsWith("http")) {
        return url;
    }

    return FurAffinityClient.SITE_ROOT + url;
}

// FA check stuff
async function processUpdateAuto<T extends { id: number }>(user: db.UserRow, lastUpdateKey: db.UserLastUpdateRows, items: T[] | undefined, process_message: (item: T) => Promise<void>) {
    let last_update = user[lastUpdateKey] || [];
    if (!Array.isArray(last_update)) {
        last_update = [last_update];
    }

    if (!items || items.length < 1) return;

    const lastUpdateMapped = _.map(last_update, (id) => ({ id }));
    const lastUpdateMax = _.max(last_update) || 0;

    let iterChain = _.chain(items).differenceBy(lastUpdateMapped, "id");
    iterChain = iterChain.filter(f => f.id > lastUpdateMax); // testing new thing
    iterChain = iterChain.take(10); // TODO: Remove 10 limit (only for testing)
    const between = iterChain.value();

    await Promise.all(_.map(between, process_message));
    user[lastUpdateKey] = _.map(items, "id");
}

async function processUserUpdate(user: db.UserRow) {
    console.log("Checking for user", user.id);
    const fa = new FurAffinityClient(user.cookie);

    const submissionsGenerator = fa.getSubmissions();
    const submissionsFirstPage = await submissionsGenerator.next();
    const submissions = submissionsFirstPage.value || undefined;

    await processUpdateAuto(user, "last_update_sub", submissions, async (item) => {
        const submission = await fa.getSubmission(item.id);
        const msgText = `Submission: <b>${escape(submission.title)}</b> by ${escape(submission.artist_name)}\n\n[ <a href="${submission.content_url}">Direct</a> | <a href="${makeUrl(item.self_link)}">Link</a> ]\n\n${bodyText(submission.body_text, 200)}`;

        await firehoseBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "__multi__", { "submission": submission.title, "submitter": submission.artist_name }, msgText);
        await focusBot.sendFirehoseMessage(user, submission.artist_name, msgText);
    });

    const messages = await fa.getMessages();

    await processUpdateAuto(user, "last_update_jou", messages?.journals, async (item) => {
        const journal = await fa.getJournal(item.id);
        const msgText = `Journal: <b>${escape(journal.title)}</b> by ${escape(journal.user_name)}\n\n[ <a href="${makeUrl(journal.self_link)}">Link</a> ]\n\n${bodyText(journal.body_text, 200)}`;

        await firehoseBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "__multi__", { "journal": item.journal_title, "submitter": item.user_name }, msgText);
        await focusBot.sendFirehoseMessage(user, item.user_name, msgText);
    });

    await processUpdateAuto(user, "last_update_com", messages?.comments, async (item) => {
        const comment = await fa.getCommentText(item.id, "submission");
        const msgText = `You received a comment from <b>${escape(item.user_name)}</b> on submission <a href="${makeUrl(item.submission_url)}">${escape(item.submission_title)}</a>\n\n${bodyText(comment.body_text, 200)}`;

        await firehoseBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.submission_title, msgText);
    });

    await processUpdateAuto(user, "last_update_jou_com", messages?.journal_comments, async (item) => {
        const comment = await fa.getCommentText(item.id, "journal");
        const msgText = `You received a comment from <b>${escape(item.user_name)}</b> on journal <a href="${makeUrl(item.url)}">${escape(item.title)}</a>\n\n${bodyText(comment.body_text, 200)}`;

        await firehoseBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.title, msgText);
    });

    await processUpdateAuto(user, "last_update_watch", messages?.watches, async (item) => {
        const msgText = `You were watched by <a href="${makeUrl(item.user_url)}">${escape(item.user_name)}</a>`;

        await firehoseBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.user_name, msgText); // TODO: Use a different filter
    });

    await processUpdateAuto(user, "last_update_shout", messages?.shouts, async (item) => {
        const myPage = await fa.getUserPage(messages.my_username);
        const shout = myPage?.shouts?.find(f => f.id === item.id);

        let msgText = `You got <a href="/users/${messages.my_username}">a shout</a> from <a href="${makeUrl(item.user_url)}">${escape(item.user_name)}</a>`;
        if (shout) {
            msgText += `\n\n${bodyText(shout.body_text, 200)}`;
        }

        await firehoseBot.sendMessage(user, msgText);
        await filterBot.sendFilteredMessage(user, "comment", item.user_name, msgText); // TODO: Use a different filter
    });

    const notes = await fa.getNotes();

    await processUpdateAuto(user, "last_update_note", notes?.notes, async (item) => {
        const note = await fa.getNote(item.id);
        await fa.moveNote(item.id, "unread"); // prev marks it read, so mark it unread

        const msgText = `You received a note from <b>${escape(item.user_name)}</b> titled <a href="${makeUrl(item.self_link)}">${escape(item.title)}</a>\n\n${bodyText(note.body_text, 200)}`;

        await firehoseBot.sendMessage(user, msgText);
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
