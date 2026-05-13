import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SERVER_URL, connectSocket } from "../socket/socket";

function Register() {
  const navigate = useNavigate();

  const [nick, setNick] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("brak");
  const [country, setCountry] = useState("Polska");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const register = async () => {
    setError("");

    try {
      const res = await fetch(`${SERVER_URL}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nick,
          name,
          age,
          gender,
          country,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Błąd rejestracji");
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
      <div className="authBox glassBox">
        <h1>Rejestracja</h1>

        {error && <p style={{ color: "#f87171", marginBottom: "15px" }}>{error}</p>}

        <input placeholder="Nick" value={nick} onChange={e => setNick(e.target.value)} />
        <input placeholder="Imię" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Wiek" type="number" value={age} onChange={e => setAge(e.target.value)} />

        <select value={gender} onChange={e => setGender(e.target.value)}>
          <option value="brak">Płeć</option>
          <option value="kobieta">Kobieta</option>
          <option value="mezczyzna">Mężczyzna</option>
          <option value="inna">Inna</option>
        </select>

        <select value={country} onChange={e => setCountry(e.target.value)}>
          <option value="Polska">Polska</option>
          <option value="Niemcy">Niemcy</option>
          <option value="Czechy">Czechy</option>
          <option value="Ukraina">Ukraina</option>
          <option value="USA">USA</option>
          <option value="Inny">Inny</option>
        </select>

        <input placeholder="Hasło" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        <button onClick={register}>Utwórz konto</button>
      </div>
    </div>
  );
}

export default Register;