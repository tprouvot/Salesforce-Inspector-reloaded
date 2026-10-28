// Stores table data in IndexedDB for passing between extension pages (Export -> Editor -> Import).
// Large query payloads exceed URL size limits, so only a temporary key is passed in the URL.
const DB_NAME = "sfir-data-editor";
const STORE_NAME = "handoff";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    let request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  let db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      let tx = db.transaction(STORE_NAME, mode);
      let request = action(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Saves payload to IndexedDB and returns its lookup key.
export async function saveHandoff(payload) {
  let now = Date.now();
  let key = now + "-" + Math.random().toString(36).slice(2, 10);
  await withStore("readwrite", store => {
    let keysRequest = store.getAllKeys();
    keysRequest.onsuccess = () => {
      for (let oldKey of keysRequest.result) {
        if (now - parseInt(oldKey, 10) > MAX_AGE_MS) {
          store.delete(oldKey);
        }
      }
    };
    store.put(payload, key);
    return null;
  });
  return key;
}

// Opens the target page in a new tab with the payload key in the URL.
export function openWithHandoff(page, args, payload) {
  let win = window.open("", "_blank");
  return saveHandoff(payload).then(key => {
    args.set("handoff", key);
    let url = new URL(page + "?" + args, location.href).href;
    if (win) win.location.href = url; else window.open(url, "_blank");
  }, err => {
    win?.close();
    throw err;
  });
}

// Loads payload from IndexedDB by key.
export function loadHandoff(key) {
  return withStore("readonly", store => store.get(key));
}
