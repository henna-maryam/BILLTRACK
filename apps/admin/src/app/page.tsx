import { RequestActions } from "../components/request-actions";
import { RoleManager } from "../components/role-manager";

type ShopSummary = {
  pendingRequests: number;
  activeShops: number;
  suspendedShops: number;
};

type RegistrationRequest = {
  id: string;
  name: string;
  category: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  status: string;
  createdAt: string;
};

type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

const apiUrl = process.env.API_URL ?? "http://localhost:4000";

async function getAdminDashboardData() {
  const [summaryResponse, requestsResponse, rolesResponse] = await Promise.all([
    fetch(`${apiUrl}/admin/shops/summary`, { cache: "no-store" }),
    fetch(`${apiUrl}/admin/registration-requests`, { cache: "no-store" }),
    fetch(`${apiUrl}/admin/roles`, { cache: "no-store" }),
  ]);

  if (!summaryResponse.ok || !requestsResponse.ok || !rolesResponse.ok) {
    throw new Error("Could not load admin dashboard data.");
  }

  const summary = (await summaryResponse.json()) as ShopSummary;
  const requestData = (await requestsResponse.json()) as {
    requests: RegistrationRequest[];
  };
  const roleData = (await rolesResponse.json()) as {
    permissions: string[];
    roles: Role[];
  };

  return {
    summary,
    requests: requestData.requests,
    permissions: roleData.permissions,
    roles: roleData.roles,
  };
}

export default async function AdminHomePage() {
  const { summary, requests, permissions, roles } = await getAdminDashboardData();

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
          <strong>{summary.pendingRequests}</strong>
        </article>
        <article className="metric">
          <span>Active shops</span>
          <strong>{summary.activeShops}</strong>
        </article>
        <article className="metric">
          <span>Suspended shops</span>
          <strong>{summary.suspendedShops}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Pending Shop Requests</h2>
          <span>{requests.length} waiting</span>
        </div>

        {requests.length === 0 ? (
          <p className="empty-state">No pending shop requests.</p>
        ) : (
          <div className="request-list">
            {requests.map((request) => (
              <article className="request-row" key={request.id}>
                <div>
                  <h3>{request.name}</h3>
                  <p>
                    {request.category} · Requested{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(request.createdAt))}
                  </p>
                </div>

                <dl>
                  <div>
                    <dt>Owner</dt>
                    <dd>{request.ownerName}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{request.ownerEmail}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{request.ownerPhone}</dd>
                  </div>
                </dl>

                <RequestActions shopId={request.id} />
              </article>
            ))}
          </div>
        )}
      </section>

      <RoleManager permissions={permissions} roles={roles} />
    </main>
  );
}
