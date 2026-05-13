import { useEffect, useState } from "react";
import { SERVER_URL } from "../socket/socket";

function Admin() {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

  const loadData = async () => {
    const usersRes = await fetch(`${SERVER_URL}/api/admin/users`, {
      headers: { Authorization: token }
    });

    const reportsRes = await fetch(`${SERVER_URL}/api/admin/reports`, {
      headers: { Authorization: token }
    });

    if (!usersRes.ok || !reportsRes.ok) {
      setMessage("Brak dostępu do panelu admina");
      return;
    }

    setUsers(await usersRes.json());
    setReports(await reportsRes.json());
  };

  const setRole = async (userId, role) => {
    const res = await fetch(`${SERVER_URL}/api/admin/set-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token
      },
      body: JSON.stringify({ userId, role })
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
      body: JSON.stringify({ reportId, status })
    });

    loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="page adminPage">
      <h1 className="title">Panel Admina</h1>

      {message && <div className="card">{message}</div>}

      <div className="adminGrid">
        <div className="card">
          <h2>Zgłoszenia</h2>

          {reports.length === 0 && <p>Brak zgłoszeń</p>}

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

        <div className="card">
          <h2>Użytkownicy i rangi</h2>

          {users.map(user => (
            <div key={user.id} className="adminItem">
              <p>
                <strong>{user.nick}</strong> — {user.name}, {user.age} lat
              </p>

              <p>Ranga: {user.role}</p>

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