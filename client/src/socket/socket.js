import { io } from "socket.io-client";

const SERVER_URL = "https://gadamytv-backend.onrender.com";

const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: {
    token: localStorage.getItem("token")
  }
});

export function connectSocket() {
  socket.auth = {
    token: localStorage.getItem("token")
  };

  if (!socket.connected) {
    socket.connect();
  }
}

export default socket;