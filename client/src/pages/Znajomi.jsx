import { useEffect, useState } from "react";
import socket, { connectSocket } from "../socket/socket";

const API = `https://gadamytv-backend.onrender.com`;

function Znajomi() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "null");

  const loadFriends = async () => {
    const res = await fetch(`${API}/api/friends`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setFriends(data);
  };

  const loadRequests = async () => {
    const res = await fetch(`${API}/api/friend-requests`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setRequests(data);
  };

  const loadMessages = async friend => {
    setActiveFriend(friend);

    const res = await fetch(`${API}/api/private/${friend.id}`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setMessages(data);
  };

  useEffect(() => {
    connectSocket();
    loadFriends();
    loadRequests();

    socket.on("new-friend-request", () => {
      loadRequests();
    });

    socket.on("friend-request-accepted", () => {
      loadFriends();
      loadRequests();
    });

    socket.on("friend-request-rejected", () => {
      loadRequests();
    });

    socket.on("private-message", msg => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off("new-friend-request");
      socket.off("friend-request-accepted");
      socket.off("friend-request-rejected");
      socket.off("private-message");
    };
  }, []);

  const acceptRequest = requestId => {
    socket.emit("accept-friend-request", requestId);

    setTimeout(() => {
      loadFriends();
      loadRequests();
    }, 300);
  };

  const rejectRequest = requestId => {
    socket.emit("reject-friend-request", requestId);

    setTimeout(() => {
      loadRequests();
    }, 300);
  };

  const send = image => {
    if (!activeFriend) return;

    socket.emit("private-message", {
      to: activeFriend.id,
      text,
      image
    });

    setText("");
  };

  const sendImage = e => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      send(reader.result);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="friendLayout">
      <div className="friendList">
        <h2>Zaproszenia</h2>

        {requests.length === 0 && (
          <p style={{ marginTop: "15px", color: "#94a3b8" }}>
            Brak zaproszeń
          </p>
        )}

        {requests.map(request => (
          <div key={request.id} className="friendItem">
            <strong>{request.from.nick}</strong>

            <p>
              {request.from.name}, {request.from.age} lat
            </p>

            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button
                className="green btn"
                onClick={() => acceptRequest(request.id)}
              >
                Akceptuj
              </button>

              <button
                className="red btn"
                onClick={() => rejectRequest(request.id)}
              >
                Odrzuć
              </button>
            </div>
          </div>
        ))}

        <h2 style={{ marginTop: "30px" }}>Znajomi</h2>

        {friends.length === 0 && (
          <p style={{ marginTop: "15px", color: "#94a3b8" }}>
            Brak znajomych
          </p>
        )}

        {friends.map(friend => (
          <div
            key={friend.id}
            className="friendItem"
            onClick={() => loadMessages(friend)}
          >
            {friend.nick}
          </div>
        ))}
      </div>

      <div className="chatPanel">
        <div className="messages">
          <h2>
            {activeFriend
              ? `Chat z ${activeFriend.nick}`
              : "Wybierz znajomego"}
          </h2>

          {messages.map(msg => (
            <div
              key={msg.id}
              className={msg.from === user?.id ? "message me" : "message other"}
            >
              {msg.text}

              {msg.image && <img src={msg.image} alt="wysłane" />}
            </div>
          ))}
        </div>

        <div className="bottomBar">
          <input
            placeholder="Napisz wiadomość..."
            value={text}
            onChange={e => setText(e.target.value)}
          />

          <label>
            Zdjęcie
            <input
              type="file"
              accept="image/*"
              onChange={sendImage}
              style={{ display: "none" }}
            />
          </label>

          <button onClick={() => send("")}>
            Wyślij
          </button>
        </div>
      </div>
    </div>
  );
}

export default Znajomi;