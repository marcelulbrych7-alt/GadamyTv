function Profil() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div className="page profilePage">
      <h1 className="title">Panel użytkownika</h1>

      <div className="profileHero">
        <div className="avatarBig">
          {user?.nick?.[0]?.toUpperCase() || "G"}
        </div>

        <div>
          <h2>{user?.nick || "Niezalogowany"}</h2>
          <p>Imię: {user?.name || "-"}</p>
          <p>Wiek: {user?.age || "-"}</p>
          <p>Ranga: {user?.role || "user"}</p>
        </div>
      </div>

      <div className="card">
        <h2>Twoje konto</h2>
        <p>Tutaj później dodamy avatar, opis profilu, ustawienia prywatności i blokady użytkowników.</p>
      </div>
    </div>
  );
}

export default Profil;