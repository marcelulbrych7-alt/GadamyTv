import { useEffect, useState } from "react";
import socket, { connectSocket } from "../socket/socket";

const API = `http://${window.location.hostname}:5000`;

function Historia() {
  const [history, setHistory] = useState([]);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const loadHistory = async () => {
    const res = await fetch(`${API}/api/history`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setHistory(data);
  };

  useEffect(() => {
    connectSocket();
    loadHistory();
  }, []);

  const addFriend = partnerId => {
    socket.emit("add-friend", partnerId);
    alert("Dodano do znajomych");
  };

  return (
    <div className="page">
      <h1 className="title">Historia rozmów</h1>

      {history.map(item => {
        const partnerId = item.users.find(id => id !== user?.id);

        return (
          <div className="card" key={item.id}>
            <h2>{item.partnerNames[user?.id]}</h2>
            <p>Typ: {item.type}</p>
            <p>Treść: {item.message}</p>
            <p>Data: {new Date(item.date).toLocaleString()}</p>

            <div className="buttons" style={{ justifyContent: "flex-start" }}>
              <button className="green" onClick={() => addFriend(partnerId)}>
                Dodaj do znajomych
              </button>

              <button className="red">
                Zablokuj
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Historia;