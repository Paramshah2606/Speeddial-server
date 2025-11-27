require('dotenv').config();

const isLive=Number(process.env.is_live);

module.exports = {
    PORT:process.env.PORT,
    DB_Password:isLive ? process.env.DB_Password_PROD : process.env.DB_Password_DEV,
    DB_Database:isLive ? process.env.DB_Database_PROD : process.env.DB_Database_DEV,
    DB_User:isLive ? process.env.DB_User_PROD : process.env.DB_User_DEV,
    DB_Port:isLive ? process.env.DB_Port_PROD : process.env.DB_Port_DEV,
    DB_Host:isLive ? process.env.DB_Host_PROD : process.env.DB_Host_DEV,
    Agora_App_Id:process.env.AGORA_APP_ID,
    Agora_App_Certificate:process.env.AGORA_APP_CERTIFICATE,
  };