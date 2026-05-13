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
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function makeId() {
  return Math.random().toString(36).substring(2) + Date.now();
}

function publicUser(user) {
  return {
    id: user.id,
    nick: user.nick,
    name: user.name,
    age: user.age
  };
}

app.post("/api/register", (req, res) => {
  const { nick, name, age, password } = req.body;

  if (!nick || !name || !age || !password) {
    return res.status(400).json({ message: "Uzupełnij wszystkie pola" });
  }

  const exists = db.users.find(u => u.nick === nick);

  if (exists) {
    return res.status(400).json({ message: "Ten nick jest zajęty" });
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
    u => u.nick === nick && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Błędny nick lub hasło" });
  }

  res.json({
    token: user.id,
    user: publicUser(user)
  });
});

app.get("/api/me", (req, res) => {
  const token = req.headers.authorization;

  const user = db.users.find(u => u.id === token);

  if (!user) {
    return res.status(401).json({ message: "Brak logowania" });
  }

  res.json(publicUser(user));
});

app.get("/api/history", (req, res) => {
  const token = req.headers.authorization;

  const history = db.history.filter(h =>
    h.users.includes(token)
  );

  res.json(history);
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

app.get("/api/private/:friendId", (req, res) => {
  const token = req.headers.authorization;
  const friendId = req.params.friendId;

  const messages = db.privateMessages.filter(m =>
    m.users.includes(token) && m.users.includes(friendId)
  );

  res.json(messages);
});

let onlineUsers = {};
let waitingChat = [];
let waitingVideo = [];
let rooms = {};

function getUserFromSocket(socket) {
  const token = socket.handshake.auth.token;
  return db.users.find(u => u.id === token);
}

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

function addHistory(type, userA, userB, message = "") {
  db.history.push({
    id: makeId(),
    type,
    users: [userA.id, userB.id],
    partnerNames: {
      [userA.id]: userB.nick,
      [userB.id]: userA.nick
    },
    message,
    date: new Date().toISOString()
  });

  saveDB();
}

function matchUsers(socket, queue, type) {
  const user = getUserFromSocket(socket);

  if (!user) {
    socket.emit("auth-error");
    return;
  }

  queue = queue.filter(s => s.id !== socket.id);

  if (queue.length > 0) {
    const partner = queue.shift();
    const partnerUser = getUserFromSocket(partner);

    const roomId = `${type}-${socket.id}-${partner.id}`;

    socket.join(roomId);
    partner.join(roomId);

    rooms[socket.id] = {
      roomId,
      type,
      partnerSocketId: partner.id,
      partnerUserId: partnerUser.id
    };

    rooms[partner.id] = {
      roomId,
      type,
      partnerSocketId: socket.id,
      partnerUserId: user.id
    };

    addHistory(type, user, partnerUser, "Rozpoczęto rozmowę");

    io.to(socket.id).emit(`${type}-found`, {
      roomId,
      initiator: true,
      partner: publicUser(partnerUser)
    });

    io.to(partner.id).emit(`${type}-found`, {
      roomId,
      initiator: false,
      partner: publicUser(user)
    });

    return queue;
  }

  queue.push(socket);
  socket.emit(`${type}-searching`);
  return queue;
}

io.on("connection", socket => {
  const user = getUserFromSocket(socket);

  if (user) {
    onlineUsers[user.id] = socket.id;
    io.emit("online-users", Object.keys(onlineUsers));
  }

  socket.on("find-chat", () => {
    leaveRoom(socket);
    waitingChat = matchUsers(socket, waitingChat, "chat");
  });

  socket.on("find-video", () => {
    leaveRoom(socket);
    waitingVideo = matchUsers(socket, waitingVideo, "video");
  });

  socket.on("send-random-message", text => {
    const room = rooms[socket.id];
    const user = getUserFromSocket(socket);

    if (!room || !user) return;

    const partnerSocket = io.sockets.sockets.get(room.partnerSocketId);

    if (partnerSocket) {
      partnerSocket.emit("receive-random-message", {
        text,
        from: publicUser(user)
      });
    }

    const partnerUser = db.users.find(u => u.id === room.partnerUserId);

    if (partnerUser) {
      addHistory("chat", user, partnerUser, text);
    }
  });

  socket.on("webrtc-signal", data => {
    const room = rooms[socket.id];

    if (!room) return;

    const partnerSocket = io.sockets.sockets.get(room.partnerSocketId);

    if (partnerSocket) {
      partnerSocket.emit("webrtc-signal", data);
    }
  });

  socket.on("next", type => {
    leaveRoom(socket);

    if (type === "chat") {
      waitingChat = matchUsers(socket, waitingChat, "chat");
    }

    if (type === "video") {
      waitingVideo = matchUsers(socket, waitingVideo, "video");
    }
  });

socket.on("send-friend-request", friendId => {
  const user = getUserFromSocket(socket);

  if (!user || !friendId) return;

  if (user.id === friendId) return;

  const alreadyFriends =
    db.friends[user.id]?.includes(friendId);

  if (alreadyFriends) {
    socket.emit("friend-request-error", "Już jesteście znajomymi");
    return;
  }

  const existingRequest = db.friendRequests.find(r =>
    r.from === user.id &&
    r.to === friendId &&
    r.status === "pending"
  );

  if (existingRequest) {
    socket.emit("friend-request-error", "Zaproszenie już zostało wysłane");
    return;
  }

  const request = {
    id: makeId(),
    from: user.id,
    to: friendId,
    status: "pending",
    date: new Date().toISOString()
  };

  db.friendRequests.push(request);
  saveDB();

  socket.emit("friend-request-sent");

  const receiverSocket = onlineUsers[friendId];

  if (receiverSocket) {
    io.to(receiverSocket).emit("new-friend-request", {
      id: request.id,
      from: publicUser(user),
      date: request.date
    });
  }
});


socket.on("accept-friend-request", requestId => {
  const user = getUserFromSocket(socket);

  if (!user) return;

  const request = db.friendRequests.find(r =>
    r.id === requestId &&
    r.to === user.id &&
    r.status === "pending"
  );

  if (!request) return;

  request.status = "accepted";

  if (!db.friends[user.id]) {
    db.friends[user.id] = [];
  }

  if (!db.friends[request.from]) {
    db.friends[request.from] = [];
  }

  if (!db.friends[user.id].includes(request.from)) {
    db.friends[user.id].push(request.from);
  }

  if (!db.friends[request.from].includes(user.id)) {
    db.friends[request.from].push(user.id);
  }

  saveDB();

  socket.emit("friend-request-accepted");

  const senderSocket = onlineUsers[request.from];

  if (senderSocket) {
    io.to(senderSocket).emit("friend-request-accepted");
  }
});


socket.on("reject-friend-request", requestId => {
  const user = getUserFromSocket(socket);

  if (!user) return;

  const request = db.friendRequests.find(r =>
    r.id === requestId &&
    r.to === user.id &&
    r.status === "pending"
  );

  if (!request) return;

  request.status = "rejected";
  saveDB();

  socket.emit("friend-request-rejected");
});

  socket.on("private-message", data => {
    const user = getUserFromSocket(socket);

    if (!user) return;

    const msg = {
      id: makeId(),
      users: [user.id, data.to],
      from: user.id,
      to: data.to,
      text: data.text || "",
      image: data.image || "",
      date: new Date().toISOString()
    };

    db.privateMessages.push(msg);
    saveDB();

    socket.emit("private-message", msg);

    const receiverSocket = onlineUsers[data.to];

    if (receiverSocket) {
      io.to(receiverSocket).emit("private-message", msg);
    }
  });

  socket.on("stop", () => {
    leaveRoom(socket);
  });

  socket.on("disconnect", () => {
    const user = getUserFromSocket(socket);

    waitingChat = waitingChat.filter(s => s.id !== socket.id);
    waitingVideo = waitingVideo.filter(s => s.id !== socket.id);

    leaveRoom(socket);

    if (user) {
      delete onlineUsers[user.id];
      io.emit("online-users", Object.keys(onlineUsers));
    }
  });
});

server.listen(5000, () => {
  console.log("SERVER DZIAŁA NA PORCIE 5000");
});