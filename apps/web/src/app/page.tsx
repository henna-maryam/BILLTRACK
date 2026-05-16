import { Button } from "@billtrack/ui";

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

      <form className="registration">
        <input name="name" placeholder="Owner name" />
        <input name="shopName" placeholder="Shop name" />
        <input name="email" placeholder="Email" type="email" />
        <input name="phone" placeholder="Phone" />
        <input name="shopCategory" placeholder="Shop category" />
        <Button type="submit">Request shop approval</Button>
      </form>
    </main>
  );
}
