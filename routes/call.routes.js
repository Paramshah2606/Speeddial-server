const pkg = require('agora-access-token');
const { Agora_App_Id, Agora_App_Certificate } = require('../config/constant');
const { CallParticipant, Call, User } = require('../models');
const { RtcTokenBuilder, RtcRole } = pkg;

const APP_ID = Agora_App_Id;
const APP_CERTIFICATE = Agora_App_Certificate;

const generateToken = (req, res) => {
  try {
    const { channelName, uid, role } = req.body;

    if (!channelName || !uid) {
      return res.status(400).json({ error: "channelName and uid are required" });
    }

    const roleToUse =
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Token valid for 1 hour
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      roleToUse,
      privilegeExpireTs
    );

    return res.json({ token });
  } catch (error) {
    console.error("Error generating Agora token:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getCallHistory = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Find all calls where this user participated
    const callParticipants = await CallParticipant.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Call,
          include: [
            {
              model: CallParticipant,
              include: [{ model: User,as:"User", attributes: ["id", "username"] }],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Format response: flatten structure
    const history = callParticipants.map((cp) => {
      const call = cp.Call;
      console.log(cp.status);
      return {
        callId: call.call_id,
        isGroupCall: call.is_group_call,
        status: call.status,
        startTime: call.start_time,
        endTime: call.end_time,
        // Current user role/status
        userRole: cp.role,
        userStatus: cp.status,
        participants: call.CallParticipants.map((p) => ({
          userId: p.user_id,
          role: p.role,
          status: p.status,
          username: p.User?.username || "Unknown",
        })),
      };
    });

    return res.json({ history });
  } catch (error) {
    console.error("Call history fetch error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  generateToken,getCallHistory
};


