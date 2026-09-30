'use strict';

import { MongoClient } from 'mongodb';
import { config } from '../config.js';

/**
 * The "Campus Security" domain (MongoDB) - stores superadmin credentials.
 */
const url = `mongodb://${config.mongo.host}/${config.mongo.db}`;
const client = new MongoClient(url, {
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS: 3000,
});
let collection = null;

export async function init() {
  await client.connect();
  collection = client.db(config.mongo.db).collection(config.mongo.collection);
  await collection.deleteMany({});
  await collection.insertMany([
    { name: 'Superadmin', pass: 'nimdarepus', clearance: 'campus-root' },
    { name: 'Campusadmin', pass: 'nimdasupmac', clearance: 'campus-ops' },
  ]);
  console.log('MongoDB campus superadmins seeded');
}

export async function ping() {
  try {
    await collection.findOne({});
    return 'up';
  } catch {
    return 'down';
  }
}

// Campus security login. The query document is built directly from the request
// body and handed to findOne as-is.
export async function authenticate(query) {
  console.log('executed query', { query });
  return collection.findOne(query);
}
