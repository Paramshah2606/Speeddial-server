const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const CallParticipant = sequelize.define(
  "CallParticipant",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    call_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("host", "participant"),
      defaultValue: "participant",
    },
    join_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    leave_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("missed", "rejected", "joined", "left"),
      defaultValue: "missed",
    },
  },
  {
    tableName: "tbl_call_participants",
    timestamps: true,
    underscored: true,
  }
);

module.exports = CallParticipant;
