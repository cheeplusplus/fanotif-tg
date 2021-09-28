import * as Loki from "lokijs";
import { promisify } from "bluebird";

export type UserLastUpdateRows = 'last_update_sub' | 'last_update_jou' | 'last_update_com' | 'last_update_jou_com' | 'last_update_watch' | 'last_update_shout' | 'last_update_note';

export interface UserRow {
    id: number | string;
    cookie?: string;

    // filter bot
    filters?: { [type: string]: string | undefined | null };
    filterComments?: boolean;

    // firehose bot
    last_update_sub?: number[];
    last_update_jou?: number[];
    last_update_com?: number[];
    last_update_jou_com?: number[];
    last_update_watch?: number[];
    last_update_shout?: number[];
    last_update_note?: number[];

    // focus bot
    firehose_list?: string[];
}


// Configure loki
const loki_options = {
    "verbose": true,
    "autosave": true
};

const user_options: Partial<CollectionOptions<UserRow>> = {
    "unique": ["id"],
    "indices": ["id"],
};

const db = new Loki("datastore.db", loki_options);
const db_promise = new Promise<Loki>((s, r) => {
    db.loadDatabase({}, () => s(db));
}).then((db_res) => {
    let db_users = db_res.getCollection<UserRow>("users");
    if (!db_users) {
        db_users = db_res.addCollection<UserRow>("users", user_options);
    }

    return { "db": db_res, db_users };
});

async function getUsersDb(): Promise<Loki.Collection<UserRow>> {
    const instance = await db_promise;
    return instance.db_users;
}


// User methods

/**
 * Get all users
 */
export async function getAllConfiguredUsers(): Promise<UserRow[]> {
    const db_users = await getUsersDb();
    return db_users.find({ "cookie": { "$ne": undefined } });
}

/**
 * Get user by ID
 * @param {Number} id
 */
export async function getUserById(id: string | number): Promise<UserRow> {
    const db_users = await getUsersDb();
    const key = { id };

    let user: UserRow | null | undefined = db_users.findOne(key);
    if (!user) {
        user = db_users.insert(key);
    }
    if (!user) {
        throw new Error("Failed to create new user.");
    }

    return user;
}

/**
 * Update a user
 */
export async function updateUser(user: any): Promise<void> {
    const db_users = await getUsersDb();
    db_users.update(user);
}

/**
 * Save the database
 */
export async function save(): Promise<void> {
    const saveDb = promisify<void>(db.saveDatabase, {"context": db});
    return saveDb();
}
