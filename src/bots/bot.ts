import { LRUCache } from "lru-cache";

import { getBotApi } from "../telegram";
import * as db from "../db";
import { MockBot } from "../telegram/mock";

export type BotCallback = (msg: import("node-telegram-bot-api").Message, match: RegExpExecArray | null) => void;
export type Message = import("node-telegram-bot-api").Message;
export type User = import("node-telegram-bot-api").User;

export class NotifBot {
    private bot: import("node-telegram-bot-api");
    private lastNotifCache: LRUCache<string, number> = new LRUCache({ ttl: 60 * 60 * 1000, ttlAutopurge: false });

    constructor(token: string) {
        process.env.NTBA_FIX_319 = "ack";
        this.bot = getBotApi(token, { "polling": true });
        this._configure();
    }

    _configure() {
        this._onText(/\/start/, (msg, match) => {
            return this.onStart(msg);
        });
    }

    _onText(regex: RegExp, callback: BotCallback) {
        return this.bot.onText(regex, (msg, match) => {
            Promise.resolve(callback(msg, match)).then().catch((err) => {
                console.warn("Bot error", err);
            });
        });
    }

    async onStart(msg: Message) {
        const chatId = msg.chat.id;
        const user = await db.getUserById(chatId);

        await this.bot.sendMessage(chatId, `Hello, ${chatId}. ${JSON.stringify(user)}`);
    }

    protected async sendMessage(user: number | string | { id: number | string }, message: string, notify?: boolean) {
        let chatId: string | number;
        if (typeof user === "object") {
            chatId = user.id;
        } else {
            chatId = user;
        }

        await this.bot.sendMessage(chatId, message, { "parse_mode": "HTML", "disable_notification": notify });
    }

    _mock_simulate_message(chatId: string, text: string) {
        return (this.bot as any as MockBot)._mock_simulate_message(chatId, text);
    }

    _mock_reply_handler(callback: (message: string) => void) {
        return (this.bot as any as MockBot)._mock_reply_handler(callback);
    }

    protected shouldNotify(key: string) {
        // Just depend on the TTL behavior instead of checking the value
        return this.lastNotifCache.has(key);
    }
    protected didNotify(key: string) {
        this.lastNotifCache.set(key, Date.now());
    }
}
