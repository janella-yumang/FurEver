import * as SQLite from 'expo-sqlite';

const DB_NAME = 'furever.db';
const CART_TABLE = 'cart_items';

let dbPromise = null;

const normalizeUserId = (userId) => String(userId || 'guest');

const getDb = async () => {
    if (!dbPromise) {
        dbPromise = SQLite.openDatabaseAsync(DB_NAME);
    }

    const db = await dbPromise;

    await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${CART_TABLE} (
            item_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            item_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (item_id, user_id)
        );`
    );

    return db;
};

export const saveCartItems = async (userId, items = []) => {
    const db = await getDb();
    const normalizedUserId = normalizeUserId(userId);

    await db.withExclusiveTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM ${CART_TABLE} WHERE user_id = ?`, normalizedUserId);

        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            const itemId = String(item?._id || item?.id || `index_${index}`);

            await db.runAsync(
                `INSERT OR REPLACE INTO ${CART_TABLE} (item_id, user_id, item_json, updated_at)
                 VALUES (?, ?, ?, ?)`,
                itemId,
                normalizedUserId,
                JSON.stringify(item),
                Date.now() + index
            );
        }
    });
};

export const getCartItems = async (userId) => {
    const db = await getDb();
    const normalizedUserId = normalizeUserId(userId);

    const rows = await db.getAllAsync(
        `SELECT item_json FROM ${CART_TABLE} WHERE user_id = ? ORDER BY updated_at ASC`,
        normalizedUserId
    );

    return rows.map((row) => JSON.parse(row.item_json));
};

export const clearCartItems = async (userId) => {
    const db = await getDb();
    const normalizedUserId = normalizeUserId(userId);

    await db.runAsync(`DELETE FROM ${CART_TABLE} WHERE user_id = ?`, normalizedUserId);
};
