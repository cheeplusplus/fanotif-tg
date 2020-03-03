import { MockBot } from "./mock";
import * as TelegramBot from "node-telegram-bot-api";

export function getBotApi(token: string, options?: TelegramBot.ConstructorOptions): import('node-telegram-bot-api') {
    if (process.env.IS_MOCK === "true") {
        return new MockBot() as any;
    } else {
        return new TelegramBot(token, options);
    }
}
