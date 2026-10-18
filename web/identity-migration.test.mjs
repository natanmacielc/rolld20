// A chave do aparelho guardada no banco de antes do RollD20 ("dice-identity") passa para o novo:
// o jogador continua com a mesma identidade. IndexedDB falso, mínimo, com clone por referência.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const databases = new Map();

function request(run) {
  const req = { onsuccess: null, onerror: null, onupgradeneeded: null };
  setTimeout(() => run(req));
  return req;
}

function storeOf(db, name) {
  const data = db.stores.get(name);
  const answer = (fn) => request((req) => {
    try {
      req.result = fn();
      req.onsuccess?.();
    } catch (e) {
      req.error = e;
      req.onerror?.();
    }
  });
  return {
    get: (k) => answer(() => data.get(k)),
    add: (v, k) => answer(() => {
      if (data.has(k)) throw new Error('ConstraintError');
      data.set(k, v);
    }),
    put: (v, k) => answer(() => data.set(k, v)),
  };
}

globalThis.indexedDB = {
  open: (name) => request((req) => {
    let db = databases.get(name);
    if (!db) {
      db = { stores: new Map(), close() {}, createObjectStore: (s) => db.stores.set(s, new Map()) };
      db.transaction = (s) => ({ objectStore: () => storeOf(db, s) });
      let aborted = false;
      req.result = db;
      req.transaction = { abort: () => { aborted = true; } };
      req.onupgradeneeded?.();
      if (aborted) {
        req.error = new Error('AbortError');
        req.onerror?.();
        return;
      }
      databases.set(name, db);
    }
    req.result = db;
    req.onsuccess?.();
  }),
  deleteDatabase: (name) => request(() => databases.delete(name)),
};

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

test('a chave do banco antigo vira a do banco novo, e o antigo é apagado', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  const publicKey = toHex(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
  const legacy = { stores: new Map([['keys', new Map([['player', { privateKey: pair.privateKey, publicKey, identityKey: 'ab'.repeat(32), links: [] }]])]]), close() {} };
  legacy.transaction = (s) => ({ objectStore: () => storeOf(legacy, s) });
  databases.set('dice-identity', legacy);

  const { identity } = await import('./identity.js');
  const me = await identity();
  assert.equal(me.publicKey, publicKey);
  assert.equal(me.identityKey, 'ab'.repeat(32), 'continua na mesma identidade (vínculos de outro aparelho incluídos)');
  assert.equal(me.persistent, true);
  assert.equal(databases.get('rolld20-identity').stores.get('keys').get('player').publicKey, publicKey);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(databases.has('dice-identity'), false, 'o banco antigo some depois da cópia');
});

test('sem banco antigo, nenhum banco vazio é criado com o nome antigo', async () => {
  databases.delete('rolld20-identity');
  const opened = [];
  const open = globalThis.indexedDB.open;
  globalThis.indexedDB.open = (name, v) => {
    opened.push(name);
    return open(name, v);
  };
  const fresh = await import(`./identity.js?fresh=${Date.now()}`);
  const me = await fresh.identity();
  assert.match(me.publicKey, /^[0-9a-f]{64}$/);
  assert.ok(opened.includes('dice-identity'), 'procurou no banco antigo');
  assert.equal(databases.has('dice-identity'), false);
  assert.ok(databases.has('rolld20-identity'));
});
