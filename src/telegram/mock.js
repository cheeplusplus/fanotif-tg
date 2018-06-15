const EventEmitter = require("events");

class MockBot {
    constructor(token, options) {
        this.handler = new EventEmitter();
    }

    onText(regexp, callback) {
        this.handler.on("text", (message) => {
            const result = regexp.exec(message.text);
            regexp.lastIndex = 0;
            if (!result) {
                return;
            }

            callback(message, result);
        });
    }

    sendMessage(chatId, text, options) {
        this.handler.emit("response", {
            "chat": {
                "id": chatId
            },
            text
        });
        return Promise.resolve();
    }

    _mock_simulate_message(chatId, text) {
        this.handler.emit("text", {
            "chat": {
                "id": chatId
            },
            text
        });
    }

    _mock_reply_handler(callback) {
        this.handler.on("response", (message) => {
            callback(message);
        });
    }
}

module.exports = MockBot;
