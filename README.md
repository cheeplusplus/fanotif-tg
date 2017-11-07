# fanotif-tg

FANotifier Telegram bot

Under the MIT license

## Server side

### Installation

Needs node 7.6.0 or greater

Run `npm install --production`

### Configuration

`config.json` in the root directory

### Running

Just run `npm run start` and the bot will run in the foreground. Currently checks every 60 seconds for updates.

## Telegram side

### Bot creation

Create a bot token from BotFather and put the token in `config.json`.

### User setup

Message the bot with `/start`, then send your FA cookies to it with `/setfacookie b=(guid); a=(guid); s=1`. You'll need to pull the `a` and `b` values from an existing session, the bot doesn't support logging in for you.

Now the bot should start sending you your submissions!

### Filter bot

A secondary bot is supported that supports specific filtering. It will automatically read your credentials from the first bot, but won't send you anything until you set a filter. You can specify submission and journal filters, and optionally have the filter bot send you your comments.

Filters use regexes. Example values:

```
/setsubmissionfilter commissions
/setjournalfilter (commissions*|slots|spots|open|ych)
/togglecomments
```

## Future TODOs

* Notification on new notes
* Enable/disable the main bot
* Allow not configuring the filter bot (or maybe enable filtering on the main bot too)
* Split off the FA parser into a seperate library in npm
