import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";

function Navbar() {
  const navigate = useNavigate();

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }

  const canSeeAdmin =
    user?.role === "support" ||
    user?.role === "admin" ||
    user?.role === "owner";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="navbar">
      <Logo />

      <div className="navLinks">
        <Link to="/">Rozmowy</Link>
        <Link to="/chat">Chat</Link>
        <Link to="/historia">Historia</Link>
        <Link to="/znajomi">Znajomi</Link>
        <Link to="/profil">Profil</Link>

        {canSeeAdmin && <Link to="/admin">Admin</Link>}
      </div>

      <div className="authButtons">
        {user ? (
          <>
            <span className={`userBadge role-${user.role}`}>
              {user.nick} • {user.role}
            </span>

            <button onClick={logout}>
              Wyloguj
            </button>
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