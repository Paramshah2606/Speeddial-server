const pkg = require('agora-access-token');
const { RtcTokenBuilder, RtcRole } = pkg;

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

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

module.exports = {
  generateToken,
};


