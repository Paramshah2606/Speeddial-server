// src/socket.js
const { Server } = require("socket.io");
const { v4: uuid } = require("uuid");
const { User, Call, CallParticipant } = require("../models");
/**
 * createSocket(server)
 * - attaches a socket.io server to the given http server
 * - maintains a simple in-memory map of online users (userNumber -> socketId)
 *
 * We'll later connect this map to DB and authentication.
 */
function createSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", credentials: true },
  });

  // in-memory map of virtualNumber -> { socketId, userId }
  // NOTE: this is ephemeral (resets on server restart). We'll persist or re-sync later.
  const onlineUsers = new Map();
  const activeCalls = new Map();
  const callUsers = new Map();

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("online users", onlineUsers);

    // Example: client should emit 'user:online' after connecting with its virtualNumber
    socket.on("user:online", ({ virtualNumber, userId }) => {
      // payload: { virtualNumber: "1001", userId: 123 }
      if (!virtualNumber) return;
      onlineUsers.set(virtualNumber.toString(), {
        socketId: socket.id,
        userId,
      });
      console.log(`User online ${virtualNumber} -> socket ${socket.id}`);
      console.log("online users", onlineUsers);
      // optional: emit back online users or ack
      socket.emit("user:online:ack", { ok: true });
    });

    // quick way to fetch online user socket by number (server-side only)
    socket.on("user:get-online", (virtualNumber, cb) => {
      const entry = onlineUsers.get(virtualNumber?.toString());
      if (cb && typeof cb === "function") cb(entry || null);
    });

    socket.on("call:request", async ({ from, to, fromUser }) => {
      console.log("Call request:", from, "->", to, fromUser);

      const receiver = onlineUsers.get(to?.toString());

      if (!receiver) {
        socket.emit("call:unavailable", {
          message: "User is offline or unavailable",
        });
        return;
      }

      const callId = uuid();

      await Call.create({
        call_id: callId,
        created_by: from,
        is_group_call: false,
        status: "ringing",
        channel_name: callId,
      });

      const callerDB = await User.findOne({ where: { callingNumber: from } });
      const receiverDB = await User.findOne({ where: { callingNumber: to } });

      await CallParticipant.bulkCreate([
        {
          call_id: callId,
          user_id: callerDB.id,
          role: "host",
          status: "joined", // caller is auto-joined
          join_time: new Date(),
        },
        {
          call_id: callId,
          user_id: receiverDB.id,
          role: "participant",
          status: "missed", // will update when they accept
        },
      ]);

      const timeoutId = setTimeout(async () => {
        console.log("Call auto-missed:", callId);

        // If call already accepted or canceled → do nothing
        const stored = activeCalls.get(callId);
        if (!stored || stored.status === "active") return;

        // DB updates
        await Call.update(
          { status: "missed", end_time: new Date() },
          { where: { call_id: callId } }
        );

        await CallParticipant.update(
          { status: "left", leave_time: new Date() },
          { where: { call_id: callId, user_id: callerDB.id } }
        );

        await CallParticipant.update(
          { status: "missed" },
          { where: { call_id: callId, user_id: receiverDB.id } }
        );

        // Notify both users
        const caller = onlineUsers.get(from.toString());
        const recv = onlineUsers.get(to.toString());

        if (caller) io.to(caller.socketId).emit("call:missed", { callId });
        if (recv) io.to(recv.socketId).emit("call:missed", { callId });

        activeCalls.delete(callId);
      }, 60_000);

      activeCalls.set(callId, {
        caller: from,
        receiver: to,
        status: "ringing",
      });

      socket.emit("call:outgoing", {
        callId,
        from,
        to,
      });

      // send incoming call to receiver
      io.to(receiver.socketId).emit("call:incoming", {
        callId,
        from,
        fromUser,
        to,
      });
    });

    socket.on("call:accept", async ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      call.status = "active";

      await Call.update({ status: "active" }, { where: { call_id: callId } });

      const caller = onlineUsers.get(call.caller.toString());
      const receiver = onlineUsers.get(call.receiver.toString());
      const receiverDB = await User.findOne({
        where: { callingNumber: call.receiver },
      });

      await CallParticipant.update(
        {
          status: "joined",
          join_time: new Date(),
        },
        {
          where: { call_id: callId, user_id: receiverDB.id },
        }
      );
      // both users get accepted event
      io.to(caller.socketId).emit("call:accepted", {
        callId,
        channelName: callId,
      });

      io.to(receiver.socketId).emit("call:accepted", {
        callId,
        channelName: callId,
      });
    });

    socket.on("call:reject", async ({ callId }) => {
      const call = activeCalls.get(callId);

      if (!call) return;

      await CallParticipant.update(
        { status: "rejected" },
        { where: { call_id: callId } }
      );

      await Call.update({ status: "rejected" }, { where: { call_id: callId } });

      const { caller, receiver } = call;
      const callerEntry = onlineUsers.get(caller);

      // Send rejection to caller
      if (callerEntry) {
        io.to(callerEntry.socketId).emit("call:rejected", {
          callId,
          message: "Call declined by user",
        });
      }

      // Cleanup
      activeCalls.delete(callId);
      callUsers.delete(callId);
    });

    socket.on("call:cancel", async ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      await Call.update(
        { status: "canceled", end_time: new Date() },
        { where: { call_id: callId } }
      );

      const callerDB = await User.findOne({
        where: { callingNumber: call.caller },
      });
      const receiverDB = await User.findOne({
        where: { callingNumber: call.receiver },
      });

      await CallParticipant.update(
        { status: "left", leave_time: new Date() },
        { where: { call_id: callId, user_id: callerDB.id } }
      );

      await CallParticipant.update(
        { status: "missed" },
        { where: { call_id: callId, user_id: receiverDB.id } }
      );

      const receiver = onlineUsers.get(call.receiver.toString());
      const caller = onlineUsers.get(call.caller.toString());
      if (receiver) io.to(receiver.socketId).emit("call:canceled", { callId });
      if (caller) io.to(receiver.socketId).emit("call:canceled", { callId });
      activeCalls.delete(callId);
      callUsers.delete(callId);
    });

    socket.on("call:end", async ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      await Call.update(
        { status: "ended", end_time: new Date() },
        { where: { call_id: callId } }
      );

      await CallParticipant.update(
        { status: "left", leave_time: new Date() },
        { where: { call_id: callId } }
      );

      const caller = onlineUsers.get(call.caller.toString());
      const receiver = onlineUsers.get(call.receiver.toString());

      if (caller) io.to(caller.socketId).emit("call:ended", { callId });
      if (receiver) io.to(receiver.socketId).emit("call:ended", { callId });

      activeCalls.delete(callId);
      callUsers.delete(callId);
    });

    socket.on("broadcast-my-info", ({ callId, uid, name }) => {
      // Store info
      if (!callUsers.has(callId)) {
        callUsers.set(callId, new Map());
      }
      callUsers.get(callId).set(String(uid), { name, socketId: socket.id });

      // Get participants and notify them
      const call = activeCalls.get(callId);
      if (call) {
        const caller = onlineUsers.get(call.caller.toString());
        const receiver = onlineUsers.get(call.receiver.toString());

        if (caller && caller.socketId !== socket.id) {
          io.to(caller.socketId).emit("user-info-response", { uid, name });
        }
        if (receiver && receiver.socketId !== socket.id) {
          io.to(receiver.socketId).emit("user-info-response", { uid, name });
        }
      }
    });

    socket.on("get-user-info", ({ uid, callId }) => {
      const users = callUsers.get(callId);
      if (users && users.has(String(uid))) {
        const userInfo = users.get(String(uid));
        console.log("user infoo",userInfo);
        socket.emit("user-info-response", { uid, name: userInfo.name });
      }
    });

    // When user disconnects — remove from onlineUsers map
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, "reason:", reason);
      // remove from map (search by socketId)
      for (const [number, info] of onlineUsers) {
        if (info.socketId === socket.id) {
          onlineUsers.delete(number);
          console.log(`User ${number} removed from online map`);
          break;
        }
      }
      callUsers.forEach((users, callId) => {
        for (const [uid, userInfo] of users) {
          if (userInfo.socketId === socket.id) {
            users.delete(uid);
            if (users.size === 0) {
              callUsers.delete(callId);
            }
            break;
          }
        }
      });
    });

    /**
     * Placeholder for call flow events — we'll implement one by one:
     *
     * socket.on("call:request", ...)    // caller -> server
     * socket.on("call:accept", ...)     // receiver -> server
     * socket.on("call:reject", ...)     // receiver -> server
     * socket.on("call:end", ...)        // either side -> server
     *
     * We'll implement these with proper validations and DB writes in later steps.
     */
  });

  // expose a small API for other modules if needed
  return { io, onlineUsers };
}

module.exports = createSocket;
