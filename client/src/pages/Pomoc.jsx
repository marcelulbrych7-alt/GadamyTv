import { useEffect, useState } from "react";
import { SERVER_URL } from "../socket/socket";

function Pomoc() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Błąd strony");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [myTickets, setMyTickets] = useState([]);

  const loadTickets = async () => {
    const res = await fetch(`${SERVER_URL}/api/my-tickets`, {
      headers: {
        Authorization: localStorage.getItem("token")
      }
    });

    if (!res.ok) return;

    const data = await res.json();
    setMyTickets(data);
  };

  const createTicket = async () => {
    setMessage("");

    const res = await fetch(`${SERVER_URL}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("token")
      },
      body: JSON.stringify({
        title,
        category,
        description
      })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.message || "Nie udało się wysłać ticketu");
      return;
    }

    setTitle("");
    setDescription("");
    setMessage("Ticket został wysłany do administracji");
    loadTickets();
  };

  useEffect(() => {
    loadTickets();
  }, []);

  return (
    <div className="page">
      <h1 className="title">Centrum Pomocy</h1>

      <div className="supportGrid">
        <div className="supportCard">
          <h2>Utwórz ticket</h2>

          <p className="mutedText">
            Opisz problem, a administracja zobaczy go w panelu admina.
          </p>

          {message && (
            <div className="noticeBox">
              {message}
            </div>
          )}

          <input
            className="supportInput"
            placeholder="Tytuł zgłoszenia"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <select
            className="supportInput"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option>Błąd strony</option>
            <option>Problem z kamerą</option>
            <option>Problem z kontem</option>
            <option>Problem z czatem</option>
            <option>Zgłoszenie użytkownika</option>
            <option>Inne</option>
          </select>

          <textarea
            className="supportTextarea"
            placeholder="Opisz dokładnie swój problem..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <button className="blue supportButton" onClick={createTicket}>
            Wyślij ticket
          </button>
        </div>

        <div className="supportCard">
          <h2>Twoje tickety</h2>

          {myTickets.length === 0 && (
            <p className="mutedText">
              Nie masz jeszcze ticketów.
            </p>
          )}

          {myTickets.map(ticket => (
            <div key={ticket.id} className="ticketBox">
              <div className="ticketTop">
                <strong>{ticket.title}</strong>
                <span className={`ticketStatus status-${ticket.status}`}>
                  {ticket.status}
                </span>
              </div>

              <p>Kategoria: {ticket.category}</p>
              <p>{ticket.description}</p>

              {ticket.answer && (
                <div className="ticketAnswer">
                  <strong>Odpowiedź supportu:</strong>
                  <p>{ticket.answer}</p>
                </div>
              )}

              <small>
                {new Date(ticket.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Pomoc;