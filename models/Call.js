const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const Call = sequelize.define(
  "Call",
  {
    call_id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_group_call: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    channel_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("ringing", "active", "ended", "canceled","rejected","missed"),
      defaultValue: "ringing",
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_calls",
    timestamps: true,
    underscored: true,
  }
);

// Associations will be set up in models/index.js or after importing models

module.exports = Call;
