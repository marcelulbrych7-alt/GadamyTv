import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = `http://${window.location.hostname}:5000`;

function Register() {
  const navigate = useNavigate();

  const [nick, setNick] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");

  const register = async () => {
    try {
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nick, name, age, password })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Błąd rejestracji");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/");
    } catch (err) {
      alert("Nie można połączyć się z serwerem");
      console.log(err);
    }
  };

  return (
    <div className="authPage">
      <div className="authBox">
        <h1>Rejestracja</h1>

        <input placeholder="Nick" value={nick} onChange={e => setNick(e.target.value)} />
        <input placeholder="Imię" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Wiek" type="number" value={age} onChange={e => setAge(e.target.value)} />
        <input placeholder="Hasło" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        <button onClick={register}>Utwórz konto</button>
      </div>
    </div>
  );
}

export default Register;