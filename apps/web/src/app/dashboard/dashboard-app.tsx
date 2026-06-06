"use client";

import { Button } from "@billtrack/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiUrl, clearStoredToken, getStoredToken } from "../../lib/api";

type Section = "dashboard" | "items" | "billing" | "staff" | "reports";
type PaymentMethod = "CASH" | "UPI";
type ReportMode = "daily" | "monthly" | "range";

type Item = {
  id: string;
  name: string;
  category: string;
  price: string;
  currentStock: number;
  lowStockThreshold: number;
};

type DashboardData = {
  shop: { name: string };
  today: {
    grossSales: number;
    cashSales: number;
    upiSales: number;
    transactionCount: number;
  };
  lowStock: Item[];
  recentPurchases: Array<{
    id: string;
    total: string;
    paymentMethod: string;
    createdAt: string;
  }>;
};

type Report = {
  grossSales: number;
  discounts: number;
  netRevenue: number;
  cashSales: number;
  upiSales: number;
  transactionCount: number;
  topSellingItems: Array<{ name: string; quantity: number }>;
};

type Role = {
  id: string;
  name: string;
  permissions: string[];
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: { id: string; name: string } | null;
};

type CartLine = {
  itemId: string;
  quantity: number;
};

type EditingItem = {
  id: string;
  name: string;
  category: string;
  price: string;
  currentStock: string;
  lowStockThreshold: string;
};

const sections: Array<{ id: Section; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "items", label: "Items" },
  { id: "billing", label: "Billing" },
  { id: "staff", label: "Staff" },
  { id: "reports", label: "Reports" },
];

function money(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    style: "currency",
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isLowStock(item: Item) {
  return item.currentStock <= item.lowStockThreshold;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function monthInputValue() {
  return new Date().toISOString().slice(0, 7);
}

export function DashboardApp() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [message, setMessage] = useState("");
  const [staffInviteLink, setStaffInviteLink] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [selectedBillingItemId, setSelectedBillingItemId] = useState("");
  const [billingQuantity, setBillingQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [reportMode, setReportMode] = useState<ReportMode>("daily");
  const [reportDate, setReportDate] = useState(todayInputValue());
  const [reportMonth, setReportMonth] = useState(monthInputValue());
  const [reportFrom, setReportFrom] = useState(todayInputValue());
  const [reportTo, setReportTo] = useState(todayInputValue());
  const [isBusy, setIsBusy] = useState(false);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [itemSearch, items]);

  const selectedBillingItem = useMemo(
    () => items.find((item) => item.id === selectedBillingItemId),
    [items, selectedBillingItemId],
  );

  const cartLines = useMemo(
    () =>
      cart
        .map((line) => {
          const item = items.find((entry) => entry.id === line.itemId);

          if (!item) {
            return null;
          }

          return {
            ...line,
            item,
            lineTotal: Number(item.price) * line.quantity,
          };
        })
        .filter((line): line is CartLine & { item: Item; lineTotal: number } =>
          Boolean(line),
        ),
    [cart, items],
  );

  const subtotal = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const finalTotal = Math.max(0, subtotal - discount);

  function reportQuery() {
    if (reportMode === "monthly") {
      return `?month=${reportMonth}`;
    }

    if (reportMode === "range") {
      return `?from=${reportFrom}&to=${reportTo}`;
    }

    return `?from=${reportDate}&to=${reportDate}`;
  }

  async function loadReport() {
    const reportResponse = await apiFetch<Report>(`/reports/sales${reportQuery()}`);
    setReport(reportResponse);
  }

  async function loadData() {
    const [dashboardResponse, itemsResponse, rolesResponse] = await Promise.all([
      apiFetch<DashboardData>("/owner/dashboard"),
      apiFetch<{ items: Item[] }>("/items"),
      apiFetch<{ roles: Role[] }>("/roles"),
    ]);

    setDashboard(dashboardResponse);
    setItems(itemsResponse.items);
    setRoles(rolesResponse.roles);
    setSelectedBillingItemId((current) => current || itemsResponse.items[0]?.id || "");

    try {
      const staffResponse = await apiFetch<{ staff: StaffMember[] }>("/staff");
      setStaff(staffResponse.staff);
    } catch {
      setStaff([]);
    }

    await loadReport();
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }

    void loadData().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load dashboard.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setIsBusy(true);
    setMessage("");

    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await runAction(async () => {
      await apiFetch("/items", {
        method: "POST",
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          category: String(formData.get("category") ?? ""),
          price: Number(formData.get("price") ?? 0),
          currentStock: Number(formData.get("currentStock") ?? 0),
          lowStockThreshold: Number(formData.get("lowStockThreshold") ?? 0),
        }),
      });
      form.reset();
      await loadData();
    }, "Item added.");
  }

  function startEditItem(item: Item) {
    setEditingItem({
      id: item.id,
      name: item.name,
      category: item.category,
      price: String(item.price),
      currentStock: String(item.currentStock),
      lowStockThreshold: String(item.lowStockThreshold),
    });
  }

  async function saveItemEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItem) {
      return;
    }

    await runAction(async () => {
      await apiFetch(`/items/${editingItem.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingItem.name,
          category: editingItem.category,
          price: Number(editingItem.price),
          currentStock: Number(editingItem.currentStock),
          lowStockThreshold: Number(editingItem.lowStockThreshold),
        }),
      });
      setEditingItem(null);
      await loadData();
    }, "Item updated.");
  }

  async function deleteItem(itemId: string) {
    await runAction(async () => {
      await apiFetch(`/items/${itemId}`, {
        method: "DELETE",
      });
      setDeleteConfirmId("");
      setCart((current) => current.filter((line) => line.itemId !== itemId));
      await loadData();
    }, "Item deleted.");
  }

  function addSelectedItemToCart() {
    if (!selectedBillingItem || billingQuantity < 1) {
      return;
    }

    setCart((current) => {
      const existing = current.find((line) => line.itemId === selectedBillingItem.id);

      if (existing) {
        return current.map((line) =>
          line.itemId === selectedBillingItem.id
            ? { ...line, quantity: line.quantity + billingQuantity }
            : line,
        );
      }

      return [
        ...current,
        { itemId: selectedBillingItem.id, quantity: billingQuantity },
      ];
    });
    setBillingQuantity(1);
  }

  function updateCartQuantity(itemId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.itemId === itemId ? { ...line, quantity: Math.max(1, quantity) } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  async function savePurchase() {
    if (cart.length === 0) {
      setMessage("Add at least one item to the bill.");
      return;
    }

    await runAction(async () => {
      await apiFetch("/purchases", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod,
          discount,
          items: cart.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
          })),
        }),
      });
      setCart([]);
      setDiscount(0);
      await loadData();
    }, "Purchase recorded.");
  }

  async function handleInviteStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    await runAction(async () => {
      const response = await apiFetch<{ activation: { url: string } }>(
        "/staff/invite",
        {
          method: "POST",
          body: JSON.stringify({
            name: String(formData.get("name") ?? ""),
            email: String(formData.get("email") ?? ""),
            roleId: String(formData.get("roleId") ?? ""),
          }),
        },
      );
      form.reset();
      setStaffInviteLink(response.activation.url);
      await loadData();
    }, "Staff invited. Share the activation link below.");
  }

  async function suspendStaff(staffId: string) {
    await runAction(async () => {
      await apiFetch(`/staff/${staffId}/suspend`, {
        method: "POST",
        body: "{}",
      });
      await loadData();
    }, "Staff suspended.");
  }

  async function handleReportSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(loadReport, "Report updated.");
  }

  async function downloadReport() {
    const token = getStoredToken();
    const response = await fetch(`${apiUrl}/reports/sales.pdf${reportQuery()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-report.pdf";
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function logout() {
    clearStoredToken();
    router.push("/login");
  }

  if (!dashboard) {
    return (
      <main className="owner-loading">
        <p>{message || "Loading dashboard..."}</p>
      </main>
    );
  }

  return (
    <main className="owner-app">
      <aside className="owner-sidebar">
        <div className="brand-block">
          <span>BillTrack</span>
          <strong>{dashboard.shop.name}</strong>
        </div>
        <nav className="section-nav" aria-label="Owner sections">
          {sections.map((section) => (
            <button
              className={activeSection === section.id ? "active" : ""}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </nav>
        <button className="logout-button" onClick={logout} type="button">
          Logout
        </button>
      </aside>

      <section className="owner-workspace">
        <header className="mobile-owner-bar">
          <div>
            <span>BillTrack</span>
            <strong>{dashboard.shop.name}</strong>
          </div>
          <button onClick={logout} type="button">
            Logout
          </button>
        </header>

        {message ? <p className="status-banner">{message}</p> : null}

        {activeSection === "dashboard" ? (
          <DashboardSection dashboard={dashboard} />
        ) : null}
        {activeSection === "items" ? (
          <ItemsSection
            deleteConfirmId={deleteConfirmId}
            editingItem={editingItem}
            filteredItems={filteredItems}
            isBusy={isBusy}
            itemSearch={itemSearch}
            onAddItem={handleAddItem}
            onCancelDelete={() => setDeleteConfirmId("")}
            onCancelEdit={() => setEditingItem(null)}
            onConfirmDelete={deleteItem}
            onEditChange={setEditingItem}
            onSaveEdit={saveItemEdit}
            onSearchChange={setItemSearch}
            onStartDelete={setDeleteConfirmId}
            onStartEdit={startEditItem}
          />
        ) : null}
        {activeSection === "billing" ? (
          <BillingSection
            billingQuantity={billingQuantity}
            cartLines={cartLines}
            discount={discount}
            finalTotal={finalTotal}
            isBusy={isBusy}
            items={items}
            onAddToCart={addSelectedItemToCart}
            onDiscountChange={setDiscount}
            onPaymentMethodChange={setPaymentMethod}
            onQuantityChange={setBillingQuantity}
            onRemoveFromCart={(itemId) =>
              setCart((current) => current.filter((line) => line.itemId !== itemId))
            }
            onSavePurchase={savePurchase}
            onSelectedItemChange={setSelectedBillingItemId}
            onUpdateCartQuantity={updateCartQuantity}
            paymentMethod={paymentMethod}
            selectedItemId={selectedBillingItemId}
            subtotal={subtotal}
          />
        ) : null}
        {activeSection === "staff" ? (
          <StaffSection
            inviteLink={staffInviteLink}
            isBusy={isBusy}
            onInvite={handleInviteStaff}
            onSuspend={suspendStaff}
            roles={roles}
            staff={staff}
          />
        ) : null}
        {activeSection === "reports" ? (
          <ReportsSection
            mode={reportMode}
            onDateChange={setReportDate}
            onDownload={downloadReport}
            onFromChange={setReportFrom}
            onModeChange={setReportMode}
            onMonthChange={setReportMonth}
            onSubmit={handleReportSubmit}
            onToChange={setReportTo}
            report={report}
            reportDate={reportDate}
            reportFrom={reportFrom}
            reportMonth={reportMonth}
            reportTo={reportTo}
          />
        ) : null}
      </section>

      <nav className="mobile-bottom-nav" aria-label="Owner mobile sections">
        {sections.map((section) => (
          <button
            className={activeSection === section.id ? "active" : ""}
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function DashboardSection({ dashboard }: { dashboard: DashboardData }) {
  return (
    <section className="owner-section">
      <div className="section-heading-row">
        <div>
          <h1>Dashboard</h1>
          <p>Today performance, stock alerts, and recent activity.</p>
        </div>
      </div>

      <div className="metric-strip">
        <MetricCard label="Today sales" value={money(dashboard.today.grossSales)} />
        <MetricCard label="Cash" value={money(dashboard.today.cashSales)} />
        <MetricCard label="UPI" value={money(dashboard.today.upiSales)} />
        <MetricCard
          label="Transactions"
          value={String(dashboard.today.transactionCount)}
        />
      </div>

      <div className="section-grid two-col">
        <article className="surface-panel">
          <div className="panel-heading">
            <h2>Low Stock</h2>
            <span>{dashboard.lowStock.length} alerts</span>
          </div>
          <div className="dense-list">
            {dashboard.lowStock.map((item) => (
              <div className="list-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.category}</span>
                </div>
                <span className="danger-pill">{item.currentStock} left</span>
              </div>
            ))}
            {dashboard.lowStock.length === 0 ? (
              <p className="empty-copy">No low-stock items.</p>
            ) : null}
          </div>
        </article>

        <article className="surface-panel">
          <div className="panel-heading">
            <h2>Recent Purchases</h2>
            <span>{dashboard.recentPurchases.length} latest</span>
          </div>
          <div className="dense-list">
            {dashboard.recentPurchases.map((purchase) => (
              <div className="list-row" key={purchase.id}>
                <div>
                  <strong>{money(purchase.total)}</strong>
                  <span>{formatDate(purchase.createdAt)}</span>
                </div>
                <span className="neutral-pill">{purchase.paymentMethod}</span>
              </div>
            ))}
            {dashboard.recentPurchases.length === 0 ? (
              <p className="empty-copy">No purchases recorded yet.</p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

type ItemsSectionProps = {
  deleteConfirmId: string;
  editingItem: EditingItem | null;
  filteredItems: Item[];
  isBusy: boolean;
  itemSearch: string;
  onAddItem: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelDelete: () => void;
  onCancelEdit: () => void;
  onConfirmDelete: (itemId: string) => Promise<void>;
  onEditChange: (item: EditingItem) => void;
  onSaveEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSearchChange: (value: string) => void;
  onStartDelete: (itemId: string) => void;
  onStartEdit: (item: Item) => void;
};

function ItemsSection({
  deleteConfirmId,
  editingItem,
  filteredItems,
  isBusy,
  itemSearch,
  onAddItem,
  onCancelDelete,
  onCancelEdit,
  onConfirmDelete,
  onEditChange,
  onSaveEdit,
  onSearchChange,
  onStartDelete,
  onStartEdit,
}: ItemsSectionProps) {
  return (
    <section className="owner-section">
      <div className="section-heading-row">
        <div>
          <h1>Items</h1>
          <p>Manage pricing, stock levels, and low-stock thresholds.</p>
        </div>
        <input
          className="section-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search items"
          value={itemSearch}
        />
      </div>

      <div className="section-grid two-col">
        <form className="surface-panel form-panel" onSubmit={onAddItem}>
          <div className="panel-heading">
            <h2>Add Item</h2>
          </div>
          <input name="name" placeholder="Item name" required />
          <input name="category" placeholder="Category" required />
          <input min="0" name="price" placeholder="Price" required type="number" />
          <input
            min="0"
            name="currentStock"
            placeholder="Current stock"
            required
            type="number"
          />
          <input
            min="0"
            name="lowStockThreshold"
            placeholder="Low stock threshold"
            required
            type="number"
          />
          <Button disabled={isBusy} type="submit">
            Add item
          </Button>
        </form>

        {editingItem ? (
          <form className="surface-panel form-panel" onSubmit={onSaveEdit}>
            <div className="panel-heading">
              <h2>Edit Item</h2>
              <button onClick={onCancelEdit} type="button">
                Cancel
              </button>
            </div>
            <input
              onChange={(event) =>
                onEditChange({ ...editingItem, name: event.target.value })
              }
              placeholder="Item name"
              required
              value={editingItem.name}
            />
            <input
              onChange={(event) =>
                onEditChange({ ...editingItem, category: event.target.value })
              }
              placeholder="Category"
              required
              value={editingItem.category}
            />
            <input
              min="0"
              onChange={(event) =>
                onEditChange({ ...editingItem, price: event.target.value })
              }
              placeholder="Price"
              required
              type="number"
              value={editingItem.price}
            />
            <input
              min="0"
              onChange={(event) =>
                onEditChange({ ...editingItem, currentStock: event.target.value })
              }
              placeholder="Current stock"
              required
              type="number"
              value={editingItem.currentStock}
            />
            <input
              min="0"
              onChange={(event) =>
                onEditChange({
                  ...editingItem,
                  lowStockThreshold: event.target.value,
                })
              }
              placeholder="Low stock threshold"
              required
              type="number"
              value={editingItem.lowStockThreshold}
            />
            <Button disabled={isBusy} type="submit">
              Save changes
            </Button>
          </form>
        ) : (
          <article className="surface-panel muted-panel">
            <h2>Stock Watch</h2>
            <p>
              Select an item to edit stock and pricing. Low-stock badges appear
              automatically when stock reaches the threshold.
            </p>
          </article>
        )}
      </div>

      <article className="surface-panel table-panel">
        <div className="panel-heading">
          <h2>Inventory</h2>
          <span>{filteredItems.length} items</span>
        </div>
        <div className="item-table">
          <div className="table-head">
            <span>Item</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Actions</span>
          </div>
          {filteredItems.map((item) => (
            <div className="table-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.category}</span>
              </div>
              <span>{money(item.price)}</span>
              <span>
                {item.currentStock}
                {isLowStock(item) ? <b className="danger-pill">Low</b> : null}
              </span>
              <div className="row-actions">
                {deleteConfirmId === item.id ? (
                  <>
                    <button
                      className="danger-action"
                      onClick={() => void onConfirmDelete(item.id)}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button onClick={onCancelDelete} type="button">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onStartEdit(item)} type="button">
                      Edit
                    </button>
                    <button onClick={() => onStartDelete(item.id)} type="button">
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredItems.length === 0 ? (
            <p className="empty-copy">No items match your search.</p>
          ) : null}
        </div>
      </article>
    </section>
  );
}

type BillingSectionProps = {
  billingQuantity: number;
  cartLines: Array<CartLine & { item: Item; lineTotal: number }>;
  discount: number;
  finalTotal: number;
  isBusy: boolean;
  items: Item[];
  onAddToCart: () => void;
  onDiscountChange: (value: number) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onQuantityChange: (value: number) => void;
  onRemoveFromCart: (itemId: string) => void;
  onSavePurchase: () => Promise<void>;
  onSelectedItemChange: (itemId: string) => void;
  onUpdateCartQuantity: (itemId: string, quantity: number) => void;
  paymentMethod: PaymentMethod;
  selectedItemId: string;
  subtotal: number;
};

function BillingSection({
  billingQuantity,
  cartLines,
  discount,
  finalTotal,
  isBusy,
  items,
  onAddToCart,
  onDiscountChange,
  onPaymentMethodChange,
  onQuantityChange,
  onRemoveFromCart,
  onSavePurchase,
  onSelectedItemChange,
  onUpdateCartQuantity,
  paymentMethod,
  selectedItemId,
  subtotal,
}: BillingSectionProps) {
  return (
    <section className="owner-section">
      <div className="section-heading-row">
        <div>
          <h1>Billing</h1>
          <p>Create multi-item purchases with discount and payment split.</p>
        </div>
      </div>

      <div className="section-grid billing-grid">
        <article className="surface-panel form-panel">
          <div className="panel-heading">
            <h2>Add To Bill</h2>
          </div>
          <select
            onChange={(event) => onSelectedItemChange(event.target.value)}
            value={selectedItemId}
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {money(item.price)} - Stock {item.currentStock}
              </option>
            ))}
          </select>
          <input
            min="1"
            onChange={(event) => onQuantityChange(Number(event.target.value))}
            type="number"
            value={billingQuantity}
          />
          <button className="primary-command" onClick={onAddToCart} type="button">
            Add item
          </button>
        </article>

        <article className="surface-panel bill-panel">
          <div className="panel-heading">
            <h2>Current Bill</h2>
            <span>{cartLines.length} lines</span>
          </div>

          <div className="bill-lines">
            {cartLines.map((line) => (
              <div className="bill-line" key={line.itemId}>
                <div>
                  <strong>{line.item.name}</strong>
                  <span>{money(line.item.price)} each</span>
                </div>
                <input
                  min="1"
                  onChange={(event) =>
                    onUpdateCartQuantity(line.itemId, Number(event.target.value))
                  }
                  type="number"
                  value={line.quantity}
                />
                <strong>{money(line.lineTotal)}</strong>
                <button onClick={() => onRemoveFromCart(line.itemId)} type="button">
                  Remove
                </button>
              </div>
            ))}
            {cartLines.length === 0 ? (
              <p className="empty-copy">No items added to this bill.</p>
            ) : null}
          </div>

          <div className="bill-summary">
            <label>
              Discount
              <input
                min="0"
                onChange={(event) => onDiscountChange(Number(event.target.value))}
                type="number"
                value={discount}
              />
            </label>
            <label>
              Payment
              <select
                onChange={(event) =>
                  onPaymentMethodChange(event.target.value as PaymentMethod)
                }
                value={paymentMethod}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </label>
            <div className="totals-box">
              <span>Subtotal {money(subtotal)}</span>
              <strong>Total {money(finalTotal)}</strong>
            </div>
          </div>

          <Button disabled={isBusy || cartLines.length === 0} onClick={() => void onSavePurchase()} type="button">
            Save purchase
          </Button>
        </article>
      </div>
    </section>
  );
}

type StaffSectionProps = {
  inviteLink: string;
  isBusy: boolean;
  onInvite: (event: React.FormEvent<HTMLFormElement>) => void;
  onSuspend: (staffId: string) => Promise<void>;
  roles: Role[];
  staff: StaffMember[];
};

function StaffSection({
  inviteLink,
  isBusy,
  onInvite,
  onSuspend,
  roles,
  staff,
}: StaffSectionProps) {
  return (
    <section className="owner-section">
      <div className="section-heading-row">
        <div>
          <h1>Staff</h1>
          <p>Invite staff, assign roles, and suspend access.</p>
        </div>
      </div>

      <div className="section-grid two-col">
        <form className="surface-panel form-panel" onSubmit={onInvite}>
          <div className="panel-heading">
            <h2>Invite Staff</h2>
          </div>
          {roles.length === 0 ? (
            <p className="empty-copy">
              Create at least one global role in the admin app before inviting
              staff.
            </p>
          ) : null}
          <input name="name" placeholder="Staff name" required />
          <input name="email" placeholder="Staff email" required type="email" />
          <select disabled={roles.length === 0} name="roleId" required>
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <Button disabled={isBusy || roles.length === 0} type="submit">
            Invite staff
          </Button>
          {inviteLink ? (
            <div className="activation-box">
              <span>Activation link</span>
              <code>{inviteLink}</code>
            </div>
          ) : null}
        </form>

        <article className="surface-panel">
          <div className="panel-heading">
            <h2>Staff Members</h2>
            <span>{staff.length} total</span>
          </div>
          <div className="dense-list">
            {staff.map((member) => (
              <div className="list-row" key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <span>
                    {member.email} - {member.role?.name ?? "No role"}
                  </span>
                </div>
                <span className="neutral-pill">{member.status}</span>
                <button onClick={() => void onSuspend(member.id)} type="button">
                  Suspend
                </button>
              </div>
            ))}
            {staff.length === 0 ? (
              <p className="empty-copy">No staff invited yet.</p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

type ReportsSectionProps = {
  mode: ReportMode;
  onDateChange: (value: string) => void;
  onDownload: () => Promise<void>;
  onFromChange: (value: string) => void;
  onModeChange: (value: ReportMode) => void;
  onMonthChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onToChange: (value: string) => void;
  report: Report | null;
  reportDate: string;
  reportFrom: string;
  reportMonth: string;
  reportTo: string;
};

function ReportsSection({
  mode,
  onDateChange,
  onDownload,
  onFromChange,
  onModeChange,
  onMonthChange,
  onSubmit,
  onToChange,
  report,
  reportDate,
  reportFrom,
  reportMonth,
  reportTo,
}: ReportsSectionProps) {
  return (
    <section className="owner-section">
      <div className="section-heading-row">
        <div>
          <h1>Reports</h1>
          <p>Review revenue, discounts, payment split, and top-selling items.</p>
        </div>
      </div>

      <form className="surface-panel report-filter" onSubmit={onSubmit}>
        <select
          onChange={(event) => onModeChange(event.target.value as ReportMode)}
          value={mode}
        >
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
          <option value="range">Custom range</option>
        </select>
        {mode === "daily" ? (
          <input
            onChange={(event) => onDateChange(event.target.value)}
            type="date"
            value={reportDate}
          />
        ) : null}
        {mode === "monthly" ? (
          <input
            onChange={(event) => onMonthChange(event.target.value)}
            type="month"
            value={reportMonth}
          />
        ) : null}
        {mode === "range" ? (
          <>
            <input
              onChange={(event) => onFromChange(event.target.value)}
              type="date"
              value={reportFrom}
            />
            <input
              onChange={(event) => onToChange(event.target.value)}
              type="date"
              value={reportTo}
            />
          </>
        ) : null}
        <Button type="submit">Apply</Button>
        <button className="secondary-command" onClick={() => void onDownload()} type="button">
          Download PDF
        </button>
      </form>

      {report ? (
        <>
          <div className="metric-strip">
            <MetricCard label="Gross" value={money(report.grossSales)} />
            <MetricCard label="Discounts" value={money(report.discounts)} />
            <MetricCard label="Net revenue" value={money(report.netRevenue)} />
            <MetricCard label="Transactions" value={String(report.transactionCount)} />
          </div>
          <div className="section-grid two-col">
            <article className="surface-panel">
              <div className="panel-heading">
                <h2>Payment Split</h2>
              </div>
              <div className="report-grid">
                <p>Cash: {money(report.cashSales)}</p>
                <p>UPI: {money(report.upiSales)}</p>
              </div>
            </article>
            <article className="surface-panel">
              <div className="panel-heading">
                <h2>Top Selling Items</h2>
              </div>
              <div className="dense-list">
                {report.topSellingItems.map((item) => (
                  <div className="list-row" key={item.name}>
                    <strong>{item.name}</strong>
                    <span className="neutral-pill">{item.quantity} sold</span>
                  </div>
                ))}
                {report.topSellingItems.length === 0 ? (
                  <p className="empty-copy">No item sales in this period.</p>
                ) : null}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
