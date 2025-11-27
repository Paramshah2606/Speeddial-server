const { Sequelize } = require('sequelize');
const { DB_Database, DB_User, DB_Password, DB_Host, DB_Port } = require('../config/constant');

const sequelize = new Sequelize(
  DB_Database,    // database name
  DB_User,    // username
  DB_Password,    // password
  {
    host: DB_Host,
    port:DB_Port,
    dialect: 'mysql',
    logging: false,       // disable logging
  }
);

module.exports = {
  sequelize,
};
