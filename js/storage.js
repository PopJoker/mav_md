/* IndexedDB：儲存 FileSystemHandle */

const DB_NAME = 'MavMD檔案記憶';
const STORE = 'handles';

const handleDB = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

export async function storeHandle(key, handle) {
    try {
        const db = await handleDB;
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(handle, key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* 略 */ }
}

export async function getStoredHandle(key) {
    try {
        const db = await handleDB;
        return await new Promise((resolve, reject) => {
            const req = db.transaction(STORE).objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch { return null; }
}

export async function permit(handle, fromClick = false) {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted' && fromClick) {
        permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    return permission === 'granted';
}