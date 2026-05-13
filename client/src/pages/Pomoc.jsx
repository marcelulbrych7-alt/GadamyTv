function Pomoc() {
  return (
    <div className="page">
      <h1 className="title">Pomoc</h1>

      <div className="card">
        <h2>Zgłoś błąd</h2>
        <p>
          Jeśli coś nie działa, napisz do supportu i opisz dokładnie problem.
        </p>

        <p style={{ marginTop: "15px" }}>
          Email supportu:
        </p>

        <h3>support@gadamytv.pl</h3>
      </div>

      <div className="card">
        <h2>Kontakt z supportem</h2>
        <p>
          Możesz zgłaszać problemy z kamerą, czatem, kontem, znajomymi albo
          innymi użytkownikami.
        </p>
      </div>

      <div className="card">
        <h2>Zgłoszenia użytkowników</h2>
        <p>
          Podczas rozmowy kliknij przycisk <strong>Zgłoś</strong>, aby wysłać
          zgłoszenie do administracji.
        </p>
      </div>
    </div>
  );
}

export default Pomoc;