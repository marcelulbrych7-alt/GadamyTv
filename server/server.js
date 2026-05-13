const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/", (req, res) => {
  res.send("GadamyTV backend działa");
});

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const DB_FILE = "./data.json";

let db = {
  users: [],
  friends: {},
  friendRequests: [],
  history: [],
  privateMessages: []
};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function makeId() {
  return Math.random().toString(36).substring(2) + Date.now();
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    nick: user.nick,
    name: user.name,
    age: user.age
  };
}

function getUserFromSocket(socket) {
  const token = socket.handshake.auth?.token;
  return db.users.find(u => u.id === token);
}

app.post("/api/register", (req, res) => {
  const { nick, name, age, password } = req.body;

  if (!nick || !name || !age || !password) {
    return res.status(400).json({
      message: "Uzupełnij wszystkie pola"
    });
  }

  const exists = db.users.find(
    u => u.nick.toLowerCase() === nick.toLowerCase()
  );

  if (exists) {
    return res.status(400).json({
      message: "Ten nick jest zajęty"
    });
  }

  const user = {
    id: makeId(),
    nick,
    name,
    age,
    password
  };

  db.users.push(user);
  db.friends[user.id] = [];

  saveDB();

  res.json({
    token: user.id,
    user: publicUser(user)
  });
});

app.post("/api/login", (req, res) => {
  const { nick, password } = req.body;

  const user = db.users.find(
    u =>
      u.nick.toLowerCase() === nick.toLowerCase() &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Błędny nick lub hasło"
    });
  }

  res.json({
    token: user.id,
    user: publicUser(user)
  });
});

app.get("/api/friends", (req, res) => {
  const token = req.headers.authorization;

  const ids = db.friends[token] || [];

  const friends = db.users
    .filter(u => ids.includes(u.id))
    .map(publicUser);

  res.json(friends);
});

app.get("/api/friend-requests", (req, res) => {
  const token = req.headers.authorization;

  const requests = db.friendRequests
    .filter(r => r.to === token && r.status === "pending")
    .map(r => {
      const fromUser = db.users.find(u => u.id === r.from);

      return {
        id: r.id,
        from: publicUser(fromUser),
        date: r.date
      };
    });

  res.json(requests);
});

let onlineUsers = {};
let waitingVideo = [];
let rooms = {};

function leaveRoom(socket) {
  const room = rooms[socket.id];

  if (!room) return;

  const partnerSocket = io.sockets.sockets.get(room.partnerSocketId);

  if (partnerSocket) {
    partnerSocket.emit("partner-left");
    delete rooms[partnerSocket.id];
  }

  socket.leave(room.roomId);
  delete rooms[socket.id];
}

function matchVideo(socket) {
  const user = getUserFromSocket(socket);

  if (!user) return;

  waitingVideo = waitingVideo.filter(s => s.id !== socket.id);

  if (waitingVideo.length > 0) {
    const partner = waitingVideo.shift();

    const partnerUser = getUserFromSocket(partner);

    if (!partnerUser) {
      waitingVideo.push(socket);
      return;
    }

    const roomId = `${socket.id}-${partner.id}`;

    socket.join(roomId);
    partner.join(roomId);

    rooms[socket.id] = {
      roomId,
      partnerSocketId: partner.id,
      partnerUserId: partnerUser.id
    };

    rooms[partner.id] = {
      roomId,
      partnerSocketId: socket.id,
      partnerUserId: user.id
    };

    io.to(socket.id).emit("video-found", {
      initiator: true,
      partner: publicUser(partnerUser)
    });

    io.to(partner.id).emit("video-found", {
      initiator: false,
      partner: publicUser(user)
    });

    console.log("MATCH:", user.nick, partnerUser.nick);

    return;
  }

  waitingVideo.push(socket);

  socket.emit("video-searching");

  console.log("WAITING:", user.nick);
}

io.on("connection", socket => {
  const user = getUserFromSocket(socket);

  console.log("CONNECTED:", user?.nick);

  if (user) {
    onlineUsers[user.id] = socket.id;
  }

  socket.on("find-video", () => {
    leaveRoom(socket);
    matchVideo(socket);
  });

  socket.on("webrtc-signal", data => {
    const room = rooms[socket.id];

    if (!room) return;

    const partnerSocket = io.sockets.sockets.get(
      room.partnerSocketId
    );

    if (partnerSocket) {
      partnerSocket.emit("webrtc-signal", data);
    }
  });

  socket.on("send-friend-request", friendId => {
    const user = getUserFromSocket(socket);

    if (!user || !friendId) return;

    const exists = db.friendRequests.find(
      r =>
        r.from === user.id &&
        r.to === friendId &&
        r.status === "pending"
    );

    if (exists) return;

    db.friendRequests.push({
      id: makeId(),
      from: user.id,
      to: friendId,
      status: "pending",
      date: new Date().toISOString()
    });

    saveDB();

    const receiverSocket = onlineUsers[friendId];

    if (receiverSocket) {
      io.to(receiverSocket).emit(
        "new-friend-request"
      );
    }
  });

  socket.on("disconnect", () => {
    waitingVideo = waitingVideo.filter(
      s => s.id !== socket.id
    );

    leaveRoom(socket);

    if (user) {
      delete onlineUsers[user.id];
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("SERVER DZIAŁA");
});