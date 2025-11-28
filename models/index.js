const User = require("./User");
const Call = require("./Call");
const CallParticipant = require("./CallParticipant");

// Define associations here
Call.hasMany(CallParticipant, {
  foreignKey: "call_id",
  sourceKey: "call_id",
});

CallParticipant.belongsTo(Call, {
  foreignKey: "call_id",
  targetKey: "call_id",
});

CallParticipant.belongsTo(User, {
  foreignKey: "user_id",
  targetKey: "id",
  as: "User",   // alias used in your include
});

User.hasMany(CallParticipant, {
  foreignKey: "user_id",
  sourceKey: "id",
  as: "CallParticipants",
});

module.exports = {
  User,
  Call,
  CallParticipant,
};
