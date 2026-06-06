import { RegistrationForm } from "../components/registration-form";

export default function HomePage() {
  return (
    <main className="shell hero">
      <section className="hero-panel">
        <h1>BillTrack</h1>
        <p>
          Fast mobile billing, stock tracking, staff access control, and sales
          reports for retail shops.
        </p>
      </section>

      <RegistrationForm />
    </main>
  );
}
