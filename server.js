// src/server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const dotenv = require("dotenv");
const models = require("./models");

dotenv.config();

const createSocket = require("./src/socket");
const { registerUser,loginUser } = require("./routes/user.routes");
const { sequelize } = require("./database");
const { generateToken, getCallHistory } = require("./routes/call.routes");
const constant = require("./config/constant");

const app = express();
app.use(cors({ origin: "*" ,credentials: true  }));

app.use(express.json());

app.post("/api/register", registerUser);

app.post("/api/login", loginUser);

app.post("/api/agora/token", generateToken);

app.get("/api/call/history", getCallHistory);

// simple health route
app.get("/", (req, res) => {
  res.json({ ok: true, service: "calling-backend" });
});

// create HTTP server and attach socket.io (see src/socket.js)
const server = http.createServer(app);

// initialize socket handlers (pass server)
createSocket(server);

// start server
const PORT = constant.PORT || 5000;
console.log("Sync starting");
sequelize.sync({alter:false,force:false}).then(() => {
  console.log("Database synced");
  server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});
