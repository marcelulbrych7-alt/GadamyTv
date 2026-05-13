import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import Rozmowy from "./pages/Rozmowy";
import Chat from "./pages/Chat";
import Historia from "./pages/Historia";
import Znajomi from "./pages/Znajomi";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Admin from "./pages/Admin";
import Profil from "./pages/Profil";
import Pomoc from "./pages/Pomoc";

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Rozmowy />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/historia" element={<Historia />} />
        <Route path="/znajomi" element={<Znajomi />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/pomoc" element={<Pomoc />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;