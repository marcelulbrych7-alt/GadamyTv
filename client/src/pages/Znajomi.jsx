import { useEffect, useState } from "react";
import socket, { connectSocket } from "../socket/socket";

const API = `http://${window.location.hostname}:5000`;

function Znajomi() {
  const [friends, setFriends] = useState([]);
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

    socket.on("private-message", msg => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off("private-message");
    };
  }, []);

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
        <h2>Znajomi</h2>

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

          <button onClick={() => send("")}>Wyślij</button>
        </div>
      </div>
    </div>
  );
}

export default Znajomi;