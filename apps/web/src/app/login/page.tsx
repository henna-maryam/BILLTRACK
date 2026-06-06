import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="shell auth-page">
      <section className="hero-panel">
        <h1>Owner Login</h1>
        <p>Sign in to manage stock, purchases, and shop reports.</p>
      </section>
      <LoginForm />
    </main>
  );
}
