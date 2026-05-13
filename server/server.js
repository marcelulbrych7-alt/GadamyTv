const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "80mb" }));

app.get("/", (req, res) => {
  res.send("GadamyTV backend działa");
});

const io = new Server(server, {
  cors: {
    origin: "*"
  },
  maxHttpBufferSize: 80 * 1024 * 1024
});

const DB_FILE = "./data.json";

let db = {
  users: [],
  friends: {},
  friendRequests: [],
  history: [],
  privateMessages: [],
  reports: [],
  tickets: []
};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

if (!db.users) db.users = [];
if (!db.friends) db.friends = {};
if (!db.friendRequests) db.friendRequests = [];
if (!db.history) db.history = [];
if (!db.privateMessages) db.privateMessages = [];
if (!db.reports) db.reports = [];
if (!db.tickets) db.tickets = [];

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function makeId() {
  return Math.random().toString(36).substring(2) + Date.now();
}

function rolePower(role) {
  if (role === "owner") return 3;
  if (role === "admin") return 2;
  if (role === "support") return 1;
  return 0;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    nick: user.nick,
    name: user.name,
    age: user.age,
    gender: user.gender || "brak",
    country: user.country || "brak",
    role: user.role || "user",
    avatar: user.avatar || "",
    bio: user.bio || "",
    socials: user.socials || {},
    achievements: user.achievements || []
  };
}

function getUserByToken(token) {
  return db.users.find(u => u.id === token);
}

function getUserFromSocket(socket) {
  const token = socket.handshake.auth?.token;
  return getUserByToken(token);
}

function fixOwner() {
  const hasOwner = db.users.some(u => u.role === "owner");

  if (!hasOwner && db.users.length > 0) {
    db.users[0].role = "owner";
    saveDB();
  }
}

function requireAdmin(req, res, minRole = "support") {
  fixOwner();

  const token = req.headers.authorization;
  const user = getUserByToken(token);

  if (!user) {
    res.status(401).json({
      message: "Brak logowania"
    });
    return null;
  }

  if (rolePower(user.role) < rolePower(minRole)) {
    res.status(403).json({
      message: "Brak uprawnień"
    });
    return null;
  }

  return user;
}

function addHistory(type, userA, userB, message = "") {
  if (!userA || !userB) return;

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

/* AUTH */

app.post("/api/register", (req, res) => {
  const { nick, name, age, gender, country, password } = req.body;

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
    gender: gender || "brak",
    country: country || "Polska",
    password,
    role: db.users.length === 0 ? "owner" : "user",
    avatar: "",
    bio: "",
    socials: {},
    achievements: ["Nowy użytkownik"],
    createdAt: new Date().toISOString()
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

  fixOwner();

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

app.get("/api/me", (req, res) => {
  fixOwner();

  const token = req.headers.authorization;
  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({
      message: "Brak logowania"
    });
  }

  res.json(publicUser(user));
});

/* HISTORY */

app.get("/api/history", (req, res) => {
  const token = req.headers.authorization;

  const history = db.history.filter(h =>
    h.users.includes(token)
  );

  res.json(history);
});

/* FRIENDS */

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
    })
    .filter(r => r.from);

  res.json(requests);
});

/* PRIVATE CHAT */

app.get("/api/private/:friendId", (req, res) => {
  const token = req.headers.authorization;
  const friendId = req.params.friendId;

  const messages = db.privateMessages.filter(m =>
    m.users.includes(token) && m.users.includes(friendId)
  );

  res.json(messages);
});

/* TICKETS */

app.post("/api/tickets", (req, res) => {
  const token = req.headers.authorization;
  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({
      message: "Musisz być zalogowany"
    });
  }

  const { title, category, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      message: "Podaj tytuł i opis zgłoszenia"
    });
  }

  const ticket = {
    id: makeId(),
    from: user.id,
    title,
    category: category || "Inne",
    description,
    status: "new",
    answer: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tickets.push(ticket);
  saveDB();

  Object.entries(onlineUsers).forEach(([userId, socketId]) => {
    const adminUser = db.users.find(u => u.id === userId);

    if (adminUser && rolePower(adminUser.role) >= 1) {
      io.to(socketId).emit("new-ticket", ticket);
    }
  });

  res.json({
    message: "Ticket został wysłany",
    ticket
  });
});

app.get("/api/my-tickets", (req, res) => {
  const token = req.headers.authorization;

  const tickets = db.tickets
    .filter(t => t.from === token)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(tickets);
});

/* ADMIN */

app.get("/api/admin/users", (req, res) => {
  const admin = requireAdmin(req, res, "support");
  if (!admin) return;

  res.json(db.users.map(publicUser));
});

app.get("/api/admin/reports", (req, res) => {
  const admin = requireAdmin(req, res, "support");
  if (!admin) return;

  const reports = db.reports.map(report => {
    const fromUser = db.users.find(u => u.id === report.from);
    const targetUser = db.users.find(u => u.id === report.target);

    return {
      ...report,
      fromUser: publicUser(fromUser),
      targetUser: publicUser(targetUser)
    };
  });

  res.json(reports);
});

app.get("/api/admin/tickets", (req, res) => {
  const admin = requireAdmin(req, res, "support");
  if (!admin) return;

  const tickets = db.tickets
    .map(ticket => {
      const fromUser = db.users.find(u => u.id === ticket.from);

      return {
        ...ticket,
        fromUser: publicUser(fromUser)
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(tickets);
});

app.post("/api/admin/ticket-status", (req, res) => {
  const admin = requireAdmin(req, res, "support");
  if (!admin) return;

  const { ticketId, status, answer } = req.body;

  const ticket = db.tickets.find(t => t.id === ticketId);

  if (!ticket) {
    return res.status(404).json({
      message: "Nie znaleziono ticketu"
    });
  }

  ticket.status = status || ticket.status;
  ticket.answer = answer || ticket.answer;
  ticket.updatedAt = new Date().toISOString();
  ticket.reviewedBy = admin.id;

  saveDB();

  res.json({
    message: "Ticket zaktualizowany"
  });
});

app.post("/api/admin/set-role", (req, res) => {
  const admin = requireAdmin(req, res, "owner");
  if (!admin) return;

  const { userId, role } = req.body;

  if (!["user", "support", "admin", "owner"].includes(role)) {
    return res.status(400).json({
      message: "Niepoprawna ranga"
    });
  }

  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({
      message: "Nie znaleziono użytkownika"
    });
  }

  user.role = role;
  saveDB();

  res.json({
    message: "Ranga zmieniona",
    user: publicUser(user)
  });
});

app.post("/api/admin/report-status", (req, res) => {
  const admin = requireAdmin(req, res, "support");
  if (!admin) return;

  const { reportId, status } = req.body;

  const report = db.reports.find(r => r.id === reportId);

  if (!report) {
    return res.status(404).json({
      message: "Nie znaleziono zgłoszenia"
    });
  }

  report.status = status;
  report.reviewedBy = admin.id;
  report.reviewedAt = new Date().toISOString();

  saveDB();

  res.json({
    message: "Zmieniono status zgłoszenia"
  });
});

/* SOCKET */

let onlineUsers = {};
let waitingVideo = [];
let waitingChat = [];
let rooms = {};

function leaveRoom(socket) {
  const room = rooms[socket.id];

  if (!room) return;

  const partnerSocket = io.sockets.sockets.get(room.partnerSocketId);

  if (partnerSocket) {
    partnerSocket.emit("partner-left");
    delete rooms[partnerSocket.id];
    partnerSocket.leave(room.roomId);
  }

  socket.leave(room.roomId);
  delete rooms[socket.id];
}

function matchUsers(socket, queue, type) {
  const user = getUserFromSocket(socket);

  if (!user) {
    socket.emit("auth-error");
    return queue;
  }

  queue = queue.filter(s => s.id !== socket.id);

  if (queue.length > 0) {
    const partner = queue.shift();
    const partnerUser = getUserFromSocket(partner);

    if (!partnerUser) {
      queue.push(socket);
      socket.emit(`${type}-searching`);
      return queue;
    }

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

  console.log("CONNECTED:", socket.id, user?.nick);

  if (user) {
    onlineUsers[user.id] = socket.id;
    io.emit("online-users", Object.keys(onlineUsers));
  }

  socket.on("find-video", () => {
    leaveRoom(socket);
    waitingVideo = matchUsers(socket, waitingVideo, "video");
  });

  socket.on("find-chat", () => {
    leaveRoom(socket);
    waitingChat = matchUsers(socket, waitingChat, "chat");
  });

  socket.on("webrtc-signal", data => {
    const room = rooms[socket.id];
    if (!room) return;

    const partnerSocket = io.sockets.sockets.get(room.partnerSocketId);

    if (partnerSocket) {
      partnerSocket.emit("webrtc-signal", data);
    }
  });

  socket.on("send-random-message", text => {
    const room = rooms[socket.id];
    const sender = getUserFromSocket(socket);

    if (!room || !sender) return;

    const partnerSocket = io.sockets.sockets.get(room.partnerSocketId);
    const partnerUser = db.users.find(u => u.id === room.partnerUserId);

    if (partnerSocket) {
      partnerSocket.emit("receive-random-message", {
        text,
        from: publicUser(sender)
      });
    }

    if (partnerUser) {
      addHistory("chat", sender, partnerUser, text);
    }
  });

  socket.on("next", type => {
    leaveRoom(socket);

    if (type === "video") {
      waitingVideo = matchUsers(socket, waitingVideo, "video");
    }

    if (type === "chat") {
      waitingChat = matchUsers(socket, waitingChat, "chat");
    }
  });

  socket.on("stop", () => {
    leaveRoom(socket);
  });

  socket.on("send-friend-request", friendId => {
    const sender = getUserFromSocket(socket);

    if (!sender || !friendId) return;
    if (sender.id === friendId) return;

    if (!db.friends[sender.id]) db.friends[sender.id] = [];
    if (!db.friends[friendId]) db.friends[friendId] = [];

    if (db.friends[sender.id].includes(friendId)) {
      socket.emit("friend-request-error", "Już jesteście znajomymi");
      return;
    }

    const exists = db.friendRequests.find(r =>
      r.from === sender.id &&
      r.to === friendId &&
      r.status === "pending"
    );

    if (exists) {
      socket.emit("friend-request-error", "Zaproszenie już wysłane");
      return;
    }

    const request = {
      id: makeId(),
      from: sender.id,
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
        from: publicUser(sender),
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

    if (!db.friends[user.id]) db.friends[user.id] = [];
    if (!db.friends[request.from]) db.friends[request.from] = [];

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

  socket.on("private-typing", data => {
    const sender = getUserFromSocket(socket);
    if (!sender || !data.to) return;

    const receiverSocket = onlineUsers[data.to];

    if (receiverSocket) {
      io.to(receiverSocket).emit("private-typing", {
        from: sender.id,
        nick: sender.nick
      });
    }
  });

  socket.on("private-read", data => {
    const reader = getUserFromSocket(socket);
    if (!reader || !data.friendId) return;

    db.privateMessages = db.privateMessages.map(msg => {
      if (msg.from === data.friendId && msg.to === reader.id) {
        return {
          ...msg,
          read: true,
          readAt: new Date().toISOString()
        };
      }

      return msg;
    });

    saveDB();

    const senderSocket = onlineUsers[data.friendId];

    if (senderSocket) {
      io.to(senderSocket).emit("private-read", {
        by: reader.id
      });
    }
  });

  socket.on("private-message", data => {
    const sender = getUserFromSocket(socket);

    if (!sender || !data.to) return;

    const msg = {
      id: makeId(),
      users: [sender.id, data.to],
      from: sender.id,
      to: data.to,
      text: data.text || "",
      media: data.media || "",
      mediaType: data.mediaType || "",
      fileName: data.fileName || "",
      voice: data.voice || "",
      video: data.video || "",
      image: data.image || "",
      read: false,
      date: new Date().toISOString()
    };

    db.privateMessages.push(msg);
    saveDB();

    socket.emit("private-message", msg);

    const receiverSocket = onlineUsers[data.to];

    if (receiverSocket) {
      io.to(receiverSocket).emit("private-message", msg);
      io.to(receiverSocket).emit("private-notification", {
        from: publicUser(sender),
        text: msg.text || "Nowa wiadomość"
      });
    }
  });

  socket.on("report-user", data => {
    const reporter = getUserFromSocket(socket);

    if (!reporter || !data.targetId) return;

    const report = {
      id: makeId(),
      from: reporter.id,
      target: data.targetId,
      reason: data.reason || "Brak powodu",
      type: data.type || "other",
      status: "new",
      date: new Date().toISOString()
    };

    db.reports.push(report);
    saveDB();

    socket.emit("report-sent");
  });

  socket.on("disconnect", () => {
    waitingVideo = waitingVideo.filter(s => s.id !== socket.id);
    waitingChat = waitingChat.filter(s => s.id !== socket.id);

    leaveRoom(socket);

    if (user) {
      delete onlineUsers[user.id];
      io.emit("online-users", Object.keys(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("SERVER DZIAŁA NA PORCIE " + PORT);
});