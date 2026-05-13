import { useEffect, useState } from "react";
import { SERVER_URL } from "../socket/socket";

function Admin() {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState({});

  const token = localStorage.getItem("token");

  const loadData = async () => {
    setMessage("");

    const usersRes = await fetch(`${SERVER_URL}/api/admin/users`, {
      headers: {
        Authorization: token
      }
    });

    const reportsRes = await fetch(`${SERVER_URL}/api/admin/reports`, {
      headers: {
        Authorization: token
      }
    });

    const ticketsRes = await fetch(`${SERVER_URL}/api/admin/tickets`, {
      headers: {
        Authorization: token
      }
    });

    if (!usersRes.ok || !reportsRes.ok || !ticketsRes.ok) {
      setMessage("Brak dostępu do panelu admina. Wyloguj się i zaloguj ponownie.");
      return;
    }

    setUsers(await usersRes.json());
    setReports(await reportsRes.json());
    setTickets(await ticketsRes.json());
  };

  const setRole = async (userId, role) => {
    const res = await fetch(`${SERVER_URL}/api/admin/set-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({
        userId,
        role
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    loadData();
  };

  const changeReportStatus = async (reportId, status) => {
    await fetch(`${SERVER_URL}/api/admin/report-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({
        reportId,
        status
      })
    });

    loadData();
  };

  const changeTicketStatus = async (ticketId, status) => {
    await fetch(`${SERVER_URL}/api/admin/ticket-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({
        ticketId,
        status,
        answer: answers[ticketId] || ""
      })
    });

    setAnswers(prev => ({
      ...prev,
      [ticketId]: ""
    }));

    loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="page adminPage">
      <h1 className="title">Panel Admina</h1>

      {message && (
        <div className="card">
          {message}
        </div>
      )}

      <div className="adminDashboard">
        <div className="adminStat">
          <strong>{users.length}</strong>
          <span>Użytkowników</span>
        </div>

        <div className="adminStat">
          <strong>{reports.length}</strong>
          <span>Zgłoszeń</span>
        </div>

        <div className="adminStat">
          <strong>{tickets.length}</strong>
          <span>Ticketów</span>
        </div>
      </div>

      <div className="adminGrid">
        <div className="card adminPanelCard">
          <h2>Tickety supportu</h2>

          {tickets.length === 0 && (
            <p>Brak ticketów</p>
          )}

          {tickets.map(ticket => (
            <div key={ticket.id} className="adminItem">
              <div className="ticketTop">
                <strong>{ticket.title}</strong>
                <span className={`ticketStatus status-${ticket.status}`}>
                  {ticket.status}
                </span>
              </div>

              <p>
                <strong>Od:</strong> {ticket.fromUser?.nick || "Nieznany"}
              </p>

              <p>
                <strong>Kategoria:</strong> {ticket.category}
              </p>

              <p>
                <strong>Opis:</strong> {ticket.description}
              </p>

              <textarea
                className="adminTextarea"
                placeholder="Odpowiedź dla użytkownika..."
                value={answers[ticket.id] || ""}
                onChange={e =>
                  setAnswers(prev => ({
                    ...prev,
                    [ticket.id]: e.target.value
                  }))
                }
              />

              <div className="buttons smallButtons">
                <button
                  className="blue"
                  onClick={() => changeTicketStatus(ticket.id, "in-progress")}
                >
                  W trakcie
                </button>

                <button
                  className="green"
                  onClick={() => changeTicketStatus(ticket.id, "closed")}
                >
                  Zamknij
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card adminPanelCard">
          <h2>Zgłoszenia użytkowników</h2>

          {reports.length === 0 && (
            <p>Brak zgłoszeń</p>
          )}

          {reports.map(report => (
            <div key={report.id} className="adminItem">
              <p>
                <strong>Zgłoszony:</strong>{" "}
                {report.targetUser?.nick || "Nieznany"}
              </p>

              <p>
                <strong>Zgłaszający:</strong>{" "}
                {report.fromUser?.nick || "Nieznany"}
              </p>

              <p>
                <strong>Powód:</strong> {report.reason}
              </p>

              <p>
                <strong>Status:</strong> {report.status}
              </p>

              <div className="buttons smallButtons">
                <button
                  className="blue"
                  onClick={() => changeReportStatus(report.id, "checked")}
                >
                  Sprawdzone
                </button>

                <button
                  className="red"
                  onClick={() => changeReportStatus(report.id, "rejected")}
                >
                  Odrzuć
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card adminPanelCard wideAdminCard">
          <h2>Użytkownicy i rangi</h2>

          {users.map(user => (
            <div key={user.id} className="adminItem userAdminRow">
              <div>
                <p>
                  <strong>{user.nick}</strong> — {user.name}, {user.age} lat
                </p>

                <p>Ranga: {user.role}</p>
              </div>

              <div className="buttons smallButtons">
                <button className="dark" onClick={() => setRole(user.id, "user")}>
                  User
                </button>

                <button className="green" onClick={() => setRole(user.id, "support")}>
                  Support
                </button>

                <button className="blue" onClick={() => setRole(user.id, "admin")}>
                  Admin
                </button>

                <button className="red" onClick={() => setRole(user.id, "owner")}>
                  Owner
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Admin;