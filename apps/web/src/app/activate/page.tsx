import { ActivationForm } from "./activation-form";
import { Suspense } from "react";

export default function ActivatePage() {
  return (
    <main className="shell auth-page">
      <section className="hero-panel">
        <h1>Activate Shop</h1>
        <p>Set your owner password to finish activating your BillTrack shop.</p>
      </section>
      <Suspense fallback={<p>Loading activation form...</p>}>
        <ActivationForm />
      </Suspense>
    </main>
  );
}
