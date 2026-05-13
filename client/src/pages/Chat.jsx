import { useEffect, useState } from "react";
import socket, { connectSocket } from "../socket/socket";

function Chat() {
  const [status, setStatus] = useState("Szukanie rozmówcy...");
  const [partner, setPartner] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setStatus("Zaloguj się, aby korzystać z chatu");
      return;
    }

    connectSocket();
    socket.emit("find-chat");

    socket.on("chat-searching", () => {
      setStatus("Szukanie aktywnej osoby...");
      setPartner(null);
      setMessages([]);
    });

    socket.on("chat-found", data => {
      setStatus("Połączono");
      setPartner(data.partner);
      setMessages([]);
    });

    socket.on("receive-random-message", msg => {
      setMessages(prev => [
        ...prev,
        {
          text: msg.text,
          me: false
        }
      ]);
    });

    socket.on("partner-left", () => {
      setStatus("Rozmówca wyszedł");
      setPartner(null);
    });

    return () => {
      socket.off("chat-searching");
      socket.off("chat-found");
      socket.off("receive-random-message");
      socket.off("partner-left");
    };
  }, []);

  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-random-message", message);

    setMessages(prev => [
      ...prev,
      {
        text: message,
        me: true
      }
    ]);

    setMessage("");
  };

  const addFriend = () => {
  if (!partner) {
    alert("Najpierw połącz się z rozmówcą");
    return;
  }

  socket.emit("send-friend-request", partner.id);
  alert("Wysłano zaproszenie do znajomych");
};
  const next = () => {
    socket.emit("next", "chat");
  };

  return (
    <div className="chatLayout">
      <div className="leftPanel">
        <h2>Informacje</h2>

        <div className="profileBox">
          <p>Status: {status}</p>

          {partner && (
            <>
              <p>Nick: {partner.nick}</p>
              <p>Imię: {partner.name}</p>
              <p>Wiek: {partner.age}</p>
            </>
          )}
        </div>

        <div className="buttons" style={{ justifyContent: "flex-start" }}>
          <button className="green" onClick={addFriend}>
            Dodaj znajomego
          </button>

          <button className="blue" onClick={next}>
            Dalej
          </button>
        </div>
      </div>

      <div className="chatPanel">
        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={msg.me ? "message me" : "message other"}
            >
              {msg.text}
            </div>
          ))}
        </div>

        <div className="bottomBar">
          <input
            placeholder="Napisz wiadomość..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />

          <button onClick={sendMessage}>Wyślij</button>
        </div>
      </div>
    </div>
  );
}

export default Chat;