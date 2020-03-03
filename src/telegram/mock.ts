import { EventEmitter } from "events";
import { BotCallback } from "../bots/bot";

export class MockBot {
    private handler: EventEmitter;

    constructor() {
        this.handler = new EventEmitter();
    }

    onText(regexp: RegExp, callback: BotCallback) {
        this.handler.on("text", (message) => {
            const result = regexp.exec(message.text);
            regexp.lastIndex = 0;
            if (!result) {
                return;
            }

            callback(message, result);
        });
    }

    sendMessage(chatId: string, text: string, options: any) {
        this.handler.emit("response", {
            "chat": {
                "id": chatId
            },
            text
        });
        return Promise.resolve();
    }

    _mock_simulate_message(chatId: string, text: string) {
        this.handler.emit("text", {
            "chat": {
                "id": chatId
            },
            text
        });
    }

    _mock_reply_handler(callback: (message: string) => void) {
        this.handler.on("response", (message) => {
            callback(message);
        });
    }
}
