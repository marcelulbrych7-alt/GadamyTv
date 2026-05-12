import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../socket/socket";

const API = `http://${window.location.hostname}:5000`;

function Login() {
  const navigate = useNavigate();

  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ nick, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    connectSocket();
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="authPage">
      <div className="authBox">
        <h1>Logowanie</h1>

        <input
          placeholder="Nick"
          value={nick}
          onChange={e => setNick(e.target.value)}
        />

        <input
          placeholder="Hasło"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button onClick={login}>Zaloguj</button>
      </div>
    </div>
  );
}

export default Login;