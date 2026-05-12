import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import Rozmowy from "./pages/Rozmowy";
import Chat from "./pages/Chat";
import Historia from "./pages/Historia";
import Znajomi from "./pages/Znajomi";
import Login from "./pages/Login";
import Register from "./pages/Register";
import About from "./pages/About";

function App() {
  useEffect(() => {
    async function askCameraPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        localStorage.setItem("cameraPermission", "granted");

        stream.getTracks().forEach(track => {
          track.stop();
        });
      } catch (err) {
        console.log("Brak zgody na kamerę/mikrofon:", err);
        localStorage.setItem("cameraPermission", "denied");
      }
    }

    if (window.isSecureContext) {
      askCameraPermission();
    } else {
      alert("Strona musi działać przez HTTPS, żeby kamera i mikrofon były dostępne.");
    }
  }, []);

  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Rozmowy />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/historia" element={<Historia />} />
        <Route path="/znajomi" element={<Znajomi />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onas" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;