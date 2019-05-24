const Promise = require("bluebird");
const Loki = require("lokijs");


// Configure loki
const loki_options = {
    "verbose": true,
    "autosave": true
};

const user_options = {
    "unique": ["id"],
    "indicies": ["id"]
};

const db = new Loki("datastore.db", loki_options);
const db_promise = new Promise((s, r) => {
    db.loadDatabase({}, () => s(db));
}).then((db) => {
    let db_users = db.getCollection("users");
    if (!db_users) {
        db_users = db.addCollection("users", user_options);
    }

    return {db, db_users};
});

async function getUsersDb() {
    return (await db_promise).db_users;
}


// User methods

/**
 * Get all users
 * @return {Promise<User[]>}
 */
exports.getAllConfiguredUsers = async () => {
    const db_users = await getUsersDb();
    return db_users.find({"cookie": {"$ne": undefined}});
};


/**
 * Get user by ID
 * @param {Number} id
 * @return {Promise<User>}
 */
exports.getUserById = async (id) => {
    const db_users = await getUsersDb();
    const key = {id};

    let user = db_users.findOne(key);
    if (!user) {
        user = db_users.insert(key);
    }

    return user;
};

/**
 * Update a user
 * @param {Object} user
 */
exports.updateUser = async (user) => {
    const db_users = await getUsersDb();
    db_users.update(user);
};

/**
 * Save the database
 * @return {Promise}
 */
exports.save = () => {
    db.saveDatabase();
    return Promise.resolve();
};
