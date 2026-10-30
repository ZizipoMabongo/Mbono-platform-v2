// Audit trail and consent records.
// With MONGODB_URI set they are stored in MongoDB (permanent, indexed, timestamped). Otherwise they use the JSON file.
const { randomUUID } = require('crypto');
function fileStore(db, save, nextId) {
  db.audit = db.audit || []; db.consents = db.consents || [];
  return { kind: 'file',
    audit: {
      add(e) { db.audit.unshift(e); if (db.audit.length > 500) db.audit.length = 500; save(); },
      async list(n) { return db.audit.slice(0, n); },
      async scrub(name) { db.audit.forEach(x => { x.m = x.m.split(name).join('Deleted candidate'); }); save(); } },
    consent: {
      add(r) { db.consents.push({ id: nextId(db.consents), ...r }); save(); },
      async forUser(id) { return db.consents.filter(c => c.userId === id); },
      async all(n) { return db.consents.slice(-n).reverse(); },
      async anonymise(id) { db.consents.forEach(c => { if (c.userId === id) c.email = null; }); save(); } } };
}
function mongoStore(m) {
  const A = m.collection('audit'), C = m.collection('consents'), hide = { projection: { _id: 0 } };
  A.createIndex({ at: -1 }); C.createIndex({ userId: 1, at: 1 });
  return { kind: 'mongodb',
    audit: {
      add: e => A.insertOne({ ...e }),
      list: n => A.find({}, hide).sort({ at: -1 }).limit(n).toArray(),
      async scrub(name) {
        const docs = await A.find({ m: { $regex: name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }).toArray();
        for (const d of docs) await A.updateOne({ _id: d._id }, { $set: { m: d.m.split(name).join('Deleted candidate') } });
      } },
    consent: {
      add: r => C.insertOne({ id: randomUUID(), ...r }),
      forUser: id => C.find({ userId: id }, hide).sort({ at: 1 }).toArray(),
      all: n => C.find({}, hide).sort({ at: -1 }).limit(n).toArray(),
      anonymise: id => C.updateMany({ userId: id }, { $set: { email: null } }) } };
}
async function createStore({ db, save, nextId, uri, dbName }) {
  if (uri) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      return mongoStore(client.db(dbName || 'mbono'));
    } catch (e) { console.error(`\n*** MongoDB not reachable (${e.message}). Using the JSON file for the audit trail and consent records instead. ***\n`); }
  }
  return fileStore(db, save, nextId);
}
module.exports = { createStore, fileStore, mongoStore };
