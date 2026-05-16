export default function AdminHomePage() {
  return (
    <main className="admin-shell">
      <header className="toolbar">
        <div>
          <h1>Superadmin Dashboard</h1>
          <p>Review shops, manage roles, and monitor platform usage.</p>
        </div>
      </header>

      <section className="grid">
        <article className="metric">
          <span>Pending requests</span>
          <strong>0</strong>
        </article>
        <article className="metric">
          <span>Active shops</span>
          <strong>0</strong>
        </article>
        <article className="metric">
          <span>Suspended shops</span>
          <strong>0</strong>
        </article>
      </section>
    </main>
  );
}
