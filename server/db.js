const Pool = require("pg").Pool;
require("dotenv").config();

const pool = new Pool({
    user: "postgres",
    password: "222",
    host: "localhost",
    port: 5432,
    database: "university_routine"
});

module.exports = pool;
