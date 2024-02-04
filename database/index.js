const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/taxFile.db');

/**
 * Executes a query on the SQLite database using the provided query and parameters.
 *
 * @param {string} query - The SQL query to be executed.
 * @param {Array} params - The parameters to be used in the query (optional).
 * @returns {Promise<Array>} A promise that resolves with an array of rows fetched from the database.
 *                           The structure of each row depends on the query.
 * @rejects {Error} If an error occurs during the database operation, the promise is rejected with the error.
 */
const runQuery = (query, params) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};
module.exports = { db, runQuery };
