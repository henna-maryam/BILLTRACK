# BillTrack — Complete Detailed Final Software Specification

## 1. Product Overview

BillTrack is a multi-tenant, mobile-first Progressive Web Application (PWA) built for retail shop owners to digitally manage daily shop operations.

It replaces manual notebook-based tracking with a structured digital platform.

The system allows shop owners to:

- Manage items and stock quantity
- Record customer purchases
- Track payment methods
- Apply discounts during billing
- Manage staff access
- Download PDF sales reports
- Operate securely inside isolated tenant workspaces

BillTrack is designed primarily for mobile users.

---

## 2. Core Product Goal

To provide a simple, fast, responsive shop management system for small businesses that need:

- faster billing
- cleaner record keeping
- secure staff access control
- monthly sales visibility

without requiring technical expertise.

---

## 3. Final User Hierarchy

# Superadmin

Platform-level administrator.

### Responsibilities

### Tenant Management
- View all shops
- Approve registrations
- Reject registrations
- Suspend shops
- Reactivate shops

### Role Management
- Create global roles
- Edit roles
- Delete roles
- Assign permissions to roles

### Platform Monitoring
- Total shops
- Active tenants
- Pending requests
- Platform usage statistics

Superadmin is the only entity allowed to manage roles.

---

# Owner

Tenant administrator.

Each shop has one owner.

Owner has complete operational control.

### Owner Permissions

## Item & Stock Management
- Add item
- Edit item
- Delete item
- Adjust stock manually
- View stock alerts

## Purchase Management
- Record purchases
- Apply discounts
- Select payment method
- View transaction history

## Staff Management
- Invite staff
- Assign predefined roles
- Suspend staff access
- Reassign roles

## Reports
- View reports
- Generate reports
- Download PDF reports

Owner can directly perform all sales operations.

---

# Staff

Restricted users.

Permissions depend on assigned role.

Staff cannot:
- Create roles
- Modify permissions
- Access unauthorized routes

---

## 4. Role & Permission Architecture

### Final Decision

Only superadmin creates roles.

Owners only assign available roles.

---

## Permission Storage

Permissions are predefined and seeded into database.

Examples:

- CREATE_PURCHASE
- VIEW_PURCHASES
- ADD_ITEM
- EDIT_ITEM
- DELETE_ITEM
- MANAGE_STAFF
- VIEW_REPORTS
- DOWNLOAD_REPORTS

---

## Role Assignment Flow

1. Superadmin creates role
2. Superadmin selects permissions
3. Owner invites staff
4. Owner assigns role
5. Staff inherits permissions automatically

---

## Authorization Rule

BillTrack is permission-driven.

The system never checks:

role name directly

It checks:

permission availability

This applies to both frontend and backend.

---

## 5. Complete User Flows

# Flow 1 — Shop Registration Request

### Step 1
Owner visits public landing page.

Submits:
- Name
- Shop name
- Email
- Phone
- Shop category

System stores request as:

PENDING_APPROVAL

No password created yet.

---

### Step 2
Superadmin dashboard receives notification.

Displays:
- Applicant name
- Shop name
- Date

---

### Step 3
Superadmin reviews.

Actions:
- Approve
- Reject

---

### Step 4 (Approved)
System sends activation email.

Contains secure token link.

---

### Step 5
Owner sets password.

Status becomes ACTIVE.

---

### Step 6
Owner logs into dashboard.

---

# Flow 2 — Staff Invitation

Owner opens Staff Management.

Inputs:
- Staff name
- Email
- Role

System sends invite email.

Staff:
1. Opens invite link
2. Sets password
3. Activates account
4. Logs in

Permissions automatically applied.

---

# Flow 3 — Add Item

Owner selects Add Item.

Form fields:
- Item name
- Category
- Price
- Current stock
- Low stock threshold

Saved to shop inventory.

---

# Flow 4 — Record Purchase

Owner or authorized staff selects:

New Purchase

### Step 1
Choose item(s)

### Step 2
Enter quantity

### Step 3
System calculates subtotal

### Step 4
Optional discount field

### Step 5
Choose payment method:
- Cash
- UPI

### Step 6
Final total calculation

Final = subtotal - discount

### Step 7
Save purchase

System automatically:
- deducts stock
- stores transaction
- updates reporting data

---

# Flow 5 — Generate Reports

Owner opens Reports.

Available filters:

## Daily
Specific date

## Date Range
Custom range

## Monthly
Full month

Generated metrics:
- Gross sales
- Discounts
- Net revenue
- Cash sales
- UPI sales
- Transaction count
- Top selling items

Actions:
- View report
- Download PDF

---

## 6. Item & Stock Management

Integrated into owner dashboard.

No separate inventory subsystem.

Functions:
- View item list
- Search item
- Edit quantity
- Update price
- Delete item
- Monitor low stock

Stock automatically decreases when sale is recorded.

---

## 7. Dashboard Modules

# Owner Dashboard

Widgets:

### Today Sales
Revenue summary

### Payment Split
Cash vs UPI

### Low Stock Alert
Items below threshold

### Recent Purchases
Latest transactions

---

# Staff Dashboard

Visible modules depend on permissions.

---

# Superadmin Dashboard

Shows:
- Pending requests
- Active shops
- Role management
- Tenant monitoring

---

## 8. Security Architecture

# Protected Applications

## Admin App
Superadmin only

## Web App
Authenticated users only

Protected routes:
- Dashboard
- Items
- Purchases
- Reports
- Staff

---

## API Validation

Every request validates:

1. Authentication
2. Active account
3. shopId ownership
4. Required permission

Authorization is permission-driven.

---

## Tenant Isolation

Every business record stores:

shopId

All queries filtered by shopId.

No cross-tenant access.

---

## Activation Security

Email tokens:
- signed
- single-use
- expiration based

---

## 9. PDF Reporting

Owners can download professional reports.

Includes:
- Shop name
- Report period
- Sales breakdown
- Payment split
- Discount summary
- Item sales summary

Formats:
- Daily PDF
- Monthly PDF
- Custom range PDF

---

## 10. PWA Requirements

### Phase 1
- Installable
- App icon
- Splash screen
- Mobile responsive

### Phase 2
- Cached shell

### Phase 3
- Offline queue sync

---

## 11. Monorepo Structure

```txt
billtrack/
  apps/
    web/
    api/
    admin/

  packages/
    db/
    auth/
    ui/
    shared/
```

---

## 12. MVP Development Order

Phase 1 — Setup

Phase 2 — Database schema

Phase 3 — Authentication

Phase 4 — Superadmin approval

Phase 5 — Protected dashboards

Phase 6 — Item management

Phase 7 — Purchase system

Phase 8 — Staff & roles

Phase 9 — PDF reports

Phase 10 — PWA

Phase 11 — Deployment

