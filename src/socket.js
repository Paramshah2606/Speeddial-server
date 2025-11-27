// src/socket.js
const { Server } = require("socket.io");
const { v4: uuid } = require("uuid");


/**
 * createSocket(server)
 * - attaches a socket.io server to the given http server
 * - maintains a simple in-memory map of online users (userNumber -> socketId)
 *
 * We'll later connect this map to DB and authentication.
 */
function createSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" ,credentials: true},
  });

  // in-memory map of virtualNumber -> { socketId, userId }
  // NOTE: this is ephemeral (resets on server restart). We'll persist or re-sync later.
  const onlineUsers = new Map();
  const activeCalls = new Map();

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    console.log("online users",onlineUsers);

    // Example: client should emit 'user:online' after connecting with its virtualNumber
    socket.on("user:online", ({ virtualNumber, userId }) => {
      // payload: { virtualNumber: "1001", userId: 123 }
      if (!virtualNumber) return;
      onlineUsers.set(virtualNumber.toString(), { socketId: socket.id, userId });
      console.log(`User online ${virtualNumber} -> socket ${socket.id}`);
      console.log("online users",onlineUsers);
      // optional: emit back online users or ack
      socket.emit("user:online:ack", { ok: true });
    });

    // quick way to fetch online user socket by number (server-side only)
    socket.on("user:get-online", (virtualNumber, cb) => {
        const entry = onlineUsers.get(virtualNumber?.toString());
        if (cb && typeof cb === "function") cb(entry || null);
        });

    socket.on("call:request", ({ from, to,fromUser }) => {
    console.log("Call request:", from, "->", to,fromUser);


    const receiver = onlineUsers.get(to?.toString());

    if (!receiver) {
        socket.emit("call:unavailable", {
        message: "User is offline or unavailable",
        });
        return;
    }
    const callId = uuid();
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

    socket.on("call:accept", ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      call.status = "active";

      const caller = onlineUsers.get(call.caller.toString());
      const receiver = onlineUsers.get(call.receiver.toString());

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

    socket.on("call:reject", ({ callId }) => {
      const call = activeCalls.get(callId);

      if (!call) return;

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
    });



    // -----------------------------
    // CALL CANCEL
    // -----------------------------
    socket.on("call:cancel", ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      const receiver = onlineUsers.get(call.receiver.toString());
      if (receiver)
        io.to(receiver.socketId).emit("call:canceled", { callId });

      activeCalls.delete(callId);
    });

    // -----------------------------
    // CALL END
    // -----------------------------
    socket.on("call:end", ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      const caller = onlineUsers.get(call.caller.toString());
      const receiver = onlineUsers.get(call.receiver.toString());

      if (caller) io.to(caller.socketId).emit("call:ended", { callId });
      if (receiver) io.to(receiver.socketId).emit("call:ended", { callId });

      activeCalls.delete(callId);
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
