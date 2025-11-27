const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,    // database name
  process.env.DB_USER,    // username
  process.env.DB_PASS,    // password
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,       // disable logging
  }
);

module.exports = {
  sequelize,
};
