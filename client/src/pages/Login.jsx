import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../socket/socket";

const API = "https://gadamytv-backend.onrender.com";

function Login() {
  const navigate = useNavigate();

  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    setError("");

    if (!nick || !password) {
      setError("Wpisz nick i hasło");
      return;
    }

    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nick,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Błąd logowania");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      connectSocket();

      navigate("/");
    } catch (err) {
      console.log(err);
      setError("Nie można połączyć się z serwerem");
    }
  };

  return (
    <div className="authPage">
      <div className="authBox">
        <h1>Logowanie</h1>

        {error && (
          <p style={{ color: "red", marginBottom: "15px" }}>
            {error}
          </p>
        )}

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

        <button onClick={login}>
          Zaloguj
        </button>
      </div>
    </div>
  );
}

export default Login;