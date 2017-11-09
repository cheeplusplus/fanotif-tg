const Promise = require("bluebird");
const superagent = require("superagent");
const cheerio = require("cheerio");
const scrape = require("scrape-it");

// TODO: Rate limiting and backoff error handling

function delay(ms) {
    return new Promise((r) => {
        setTimeout(r, ms);
    });
}

function fixProtoless(str) {
    return `https:${str}`;
}

function fixDomainless(str) {
    return `https://www.furaffinity.net${str}`;
}

class FurAffinityClient {
    constructor(cookies) {
        this.cookies = cookies;
    }

    static checkErrors(req) {
        if (req.status !== 200) {
            return req.status;
        }

        if (req.text.indexOf("This user has voluntarily disabled access to their userpage.") > -1) {
            return 403;
        }

        if (req.text.indexOf("The submission you are trying to find is not in our database.") > -1) {
            return 404;
        }

        if (req.text.indexOf("For more information please check the") > -1) {
            return 500;
        }

        if (req.text.indexOf("The server is currently having difficulty responding to all requests.") > -1) {
            return 503;
        }

        return 200;
    }

    async _scrape(url, options, attempt=1) {
        const req = await superagent.get(url).set("Cookie", this.cookies).ok((res) => true);
        const status = FurAffinityClient.checkErrors(req);
        if (status !== 200) {
            console.warn(`FA error: Got HTTP error ${status} at ${url}`);

            // For server errors, attempt retry w/ exponential backoff
            if (status >= 500 && attempt <= 6) { // 2^6=64 so 60sec
                await delay(Math.pow(2, attempt) * 1000);
                return this._scrape(url, options, attempt+1);
            }

            return;
        }

        const parsed = cheerio.load(req.text);
        return scrape.scrapeHTML(parsed, options);
    }

    getSubmissions() {
        return this._scrape("https://www.furaffinity.net/msg/submissions/", {
            "submissions": {
                "listItem": "figure.t-image",
                "data": {
                    "id": {
                        "selector": "input[type='checkbox']",
                        "attr": "value",
                        "convert": parseInt
                    },
                    "title": "figcaption > label > p:nth-child(2) > a",
                    "artist": "figcaption > label > p:nth-child(3) > a",
                    "thumb": {
                        "selector": "b > u > a > img",
                        "attr": "src",
                        "convert": fixProtoless
                    },
                    "url": {
                        "selector": "b > u > a",
                        "attr": "href",
                        "convert": fixDomainless
                    }
                }
            }
        });
    }

    getSubmission(id) {
        return this._scrape(`https://www.furaffinity.net/view/${id}/`, {
            "title": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > th",
            "thumb": {
                "selector": "#submissionImg",
                "attr": "data-preview-src",
                "convert": fixProtoless
            },
            "url": {
                "selector": "#submissionImg",
                "attr": "data-fullview-src",
                "convert": fixProtoless
            },
            "artist": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(1) > td.cat > a",
            "artist_url": {
                "selector": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(1) > td.cat > a",
                "attr": "href",
                "convert": fixDomainless
            },
            "artist_thumb": {
                "selector": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > a:nth-child(1) > img",
                "attr": "src",
                "convert": fixProtoless
            },
            "body_text": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td",
            "body_html": {
                "selector": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td",
                "how": "html"
            },
            "when": "#page-submission > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(1) > td.alt1 > table > tbody > tr > td > span",
            "keywords": {
                "listItem": "#keywords > a",
                "data": {
                    "value": ""
                }
            },
            "comments": this._getCommentsObj("#comments-submission")
        });
    }

    getMessages() {
        return this._scrape("https://www.furaffinity.net/msg/others/", {
            "watches": {
                "listItem": "ul#watches > li:not(.section-controls)",
                "data": {
                    "id": {
                        "selector": "input[type='checkbox']",
                        "attr": "value",
                        "convert": parseInt
                    },
                    "user_name": "div > span",
                    "user_url": {
                        "selector": "a",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "user_thumb": {
                        "selector": "img",
                        "attr": "src",
                        "convert": fixProtoless
                    },
                    "when": "div > small > span"
                }
            },
            "comments": {
                "listItem": "ul#comments > li:not(.section-controls)",
                "data": {
                    "id": {
                        "selector": "input[type='checkbox']",
                        "attr": "value",
                        "convert": parseInt
                    },
                    "title": "a:nth-child(4)",
                    "url": {
                        "selector": "a:nth-child(4)",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "user_name": "a:nth-child(2)",
                    "user_url": {
                        "selector": "a:nth-child(2)",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "when": "span"
                }
            },
            "favorites": {
                "listItem": "ul#favorites > li:not(.section-controls)",
                "data": {
                    "id": {
                        "selector": "input[type='checkbox']",
                        "attr": "value",
                        "convert": parseInt
                    },
                    "title": "a:nth-child(3)",
                    "url": {
                        "selector": "a:nth-child(3)",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "user_name": "a:nth-child(2)",
                    "user_url": {
                        "selector": "a:nth-child(2)",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "when": "span"
                }
            },
            "journals": {
                "listItem": "ul#journals > li:not(.section-controls)",
                "data": {
                    "id": {
                        "selector": "input[type='checkbox']",
                        "attr": "value",
                        "convert": parseInt
                    },
                    "title": "a:nth-child(2)",
                    "url": {
                        "selector": "a:nth-child(2)",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "user_name": "a:nth-child(3)",
                    "user_url": {
                        "selector": "a:nth-child(3)",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "is_stream": {
                        "selector": "",
                        "attr": "class",
                        "convert": (s) => !!(s && s.contains("stream-notification"))
                    },
                    "when": "span"
                }
            }
        });
    }

    getJournal(id) {
        return this._scrape(`https://www.furaffinity.net/journal/${id}/`, {
            "title": "#page-journal > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr > td.journal-title-box > b > font > div",
            "user_name": "#page-journal > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr > td.journal-title-box > a",
            "user_url": {
                "selector": "#page-journal > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr > td.journal-title-box > a",
                "attr": "href",
                "convert": fixDomainless
            },
            "user_thumb": {
                "selector": "#page-journal > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr > td.avatar-box > a > img",
                "attr": "src",
                "convert": fixProtoless
            },
            "body_text": "div.journal-body",
            "body_html": {
                "selector": "div.journal-body",
                "how": "html"
            },
            "when": "#page-journal > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr > td.journal-title-box > span",
            "comments": this._getCommentsObj("#page-comments")
        });
    }

    getNotes() {
        return this._scrape("https://www.furaffinity.net/msg/pms/", {
            "notes": {
                "listItem": "#notes-list > tbody > tr.note",
                "data": {
                    "id": {
                        "selector": "input[type='checkbox']",
                        "attr": "value",
                        "convert": parseInt
                    },
                    "title": "td.subject > a",
                    "url": {
                        "selector": "td.subject > a",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "user_name": "td.col-from > a",
                    "user_url": {
                        "selector": "td.col-from > a",
                        "attr": "href",
                        "convert": fixDomainless
                    },
                    "unread": {
                        "selector": "td.subject > a",
                        "attr": "class",
                        "convert": (s) => !!(s && s.indexOf("unread") > -1)
                    },
                    "when": "td:nth-child(3) > span"
                }
            }
        });
    }

    getNote(id) {
        // TODO: Improve how the body and when are pulled
        return this._scrape(`https://www.furaffinity.net/viewmessage/${id}/`, {
            "title": "#pms-form > table.maintable > tbody > tr:nth-child(2) > td > font:nth-child(1) > b",
            "user_name": "#pms-form > table.maintable > tbody > tr:nth-child(2) > td > font:nth-child(3) > a:nth-child(1)",
            "user_url": {
                "selector": "#pms-form > table.maintable > tbody > tr:nth-child(2) > td > font:nth-child(3) > a:nth-child(1)",
                "attr": "href",
                "convert": fixDomainless
            },
            "body_text": "#pms-form > table.maintable > tbody > tr:nth-child(2) > td",
            "body_html": {
                "selector": "#pms-form > table.maintable > tbody > tr:nth-child(2) > td",
                "how": "html"
            },
            "when": {
                "selector": "#pms-form > table.maintable > tbody > tr:nth-child(2) > td > font:nth-child(3)",
                "convert": (s) => {
                    const dateInd = s.indexOf(" On: ");
                    return s.substring(dateInd + 5);
                }
            }
        });
    }

    _getCommentsObj(selector) {
        return {
            "listItem": `${selector} table.container-comment`,
            "data": {
                "id": {
                    "attr": "id",
                    "convert": (s) => parseInt(s.split(":")[1])
                },
                "user_name": "tbody > tr:nth-child(1) > td:nth-child(3) > div > ul > li > b",
                "user_url": {
                    "selector": "tbody > tr:nth-child(1) > td:nth-child(3) > div > ul > li > ul > li:nth-child(1) > a",
                    "attr": "href",
                    "convert": fixDomainless
                },
                "user_thumb": {
                    "selector": "img.avatar",
                    "attr": "src",
                    "convert": fixProtoless
                },
                "body_text": "div.message-text",
                "body_html": {
                    "selector": "div.message-text",
                    "how": "html"
                },
                "timestamp": {
                    "attr": "data-timestamp",
                    "convert": (s) => new Date(parseInt(s) * 1000)
                },
                "when": "tbody > tr:nth-child(2) > th:nth-child(2) > h4 > span"
            }
        };
    }
}


module.exports = FurAffinityClient;
