"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Role = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

type RoleManagerProps = {
  permissions: string[];
  roles: Role[];
};

export function RoleManager({ permissions, roles }: RoleManagerProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function createRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(`${apiUrl}/admin/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? ""),
          permissions: formData.getAll("permissions").map(String),
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message ?? body?.error ?? "Could not create role.");
      }

      form.reset();
      setMessage("Role created.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create role.");
    }
  }

  async function deleteRole(roleId: string) {
    try {
      const response = await fetch(`${apiUrl}/admin/roles/${roleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Could not delete role.");
      }

      setMessage("Role deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete role.");
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Global Roles</h2>
        <span>{roles.length} roles</span>
      </div>

      <form className="role-form" onSubmit={createRole}>
        <input name="name" placeholder="Role name" required />
        <input name="description" placeholder="Description" />
        <div className="permission-grid">
          {permissions.map((permission) => (
            <label key={permission}>
              <input name="permissions" type="checkbox" value={permission} />
              {permission}
            </label>
          ))}
        </div>
        <button type="submit">Create role</button>
      </form>

      {message ? <p className="action-message success">{message}</p> : null}

      <div className="request-list">
        {roles.map((role) => (
          <article className="role-row" key={role.id}>
            <div>
              <h3>{role.name}</h3>
              <p>{role.description || "No description"}</p>
            </div>
            <p>{role.permissions.join(", ")}</p>
            <button onClick={() => void deleteRole(role.id)} type="button">
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
