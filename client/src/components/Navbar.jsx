import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="navbar">
      <div className="navLinks">
        <Link to="/znajomi">Znajomi</Link>
        <Link to="/">Rozmowy</Link>
        <Link to="/chat">Chat</Link>
        <Link to="/historia">Historia</Link>
        <Link to="/onas">O nas</Link>
      </div>

      <div className="logo">Gadamy.TV</div>

      <div className="authButtons">
        {user ? (
          <>
            <span className="userBadge">{user.nick}</span>
            <button onClick={logout}>Wyloguj</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Rejestracja</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default Navbar;