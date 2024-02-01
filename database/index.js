const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/taxFile.db');
module.exports = db;
