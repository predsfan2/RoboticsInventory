# Feature gaps and opportunities

Review of every module in Robotics Inventory against what the code actually does. Each section lists **gaps** (incomplete, inconsistent, or broken wiring of an existing feature) then **opportunities** (new capabilities that fit this product).

Severity: **P0** = data integrity / misleading numbers / permission hole. **P1** = existing feature is half-built. **P2** = high-value for a robotics team. **P3** = polish.

**Status (selected plan):** P0 integrity items in this file (location cascade, hide illegal buttons, kits/units, receive-into-item, reverse-on-delete, goal double-count warning, fundraiser entry CRUD, borrows not stomping the whole item) plus the selected P1/P2 ideas (kit assemble/break, purchase finance prompt, High PO approval, event load-out, location parent + dates, CSV/barcodes, Hub expansion, search/account, security, unified approvals) are **implemented**. Calibration/repair-due remains out of scope.

There is still no “venues” entity. Location and fundraiser gaps are called out in those sections.

---

## 1. App shell and global UX

### Gaps

- **Done.** Mobile bottom nav: first 4 tabs plus a **More** sheet for the rest (Team, Hub, Locations, Activity, Finance, Approvals, Account). (was P1)
- **Done.** Global search opens the record (`/inventory?item=`, purchase/borrow highlight) and includes locations + finance descriptions. USB scanners type into search / Inventory `?q=`. (was P1)
- **Done.** `/account` — change own password and sign out other sessions. (was P1)
- **No empty-permission explanation.** Hitting a gated URL silently redirects to Dashboard. (P3)
- Dark theme only; no density / compact list toggle beyond inventory grid vs list. (P3)

### Opportunities

- Deep-link search: open Item Detail / highlight the purchase row.
- Search finance descriptions, fundraiser names, locations.
- Mobile “More” sheet for overflow nav instead of burying pages in the hamburger.
- Profile menu: change own password, sign out all sessions.
- Keyboard shortcuts cheat sheet (Ctrl+K is the only advertised one).

---

## 2. Authentication and security

### Gaps

- **Done.** Public `GET /api/auth/usernames` removed. Login is name + password. (was P1)
- **Done.** `mustChangePassword` on users; `/account` until cleared. Seed Admin is off — change `admin123` in production. (was P1)
- **Done.** `tokenVersion` on JWT; password change and “Sign out other sessions” increment it. `?token=` query no longer accepted. (was P2)
- No 2FA, no lockout beyond login rate limit. Hub devices can be revoked; browser sessions cannot be listed individually. (P2)

### Opportunities

- Invite links instead of a public directory.
- Forced password change on first login.
- “Sign out all other sessions.”
- Optional PIN for shop tablets (the migration still mentions old `pin` fields).

---

## 3. Roles and permissions

### Gaps

- **Done.** Move-request and Condition **Update** are hidden unless the API would allow them. Item Detail Edit/Delete is wired from Whereabouts and Condition. (was P0/P1)
- Activity API allows `inventory.view` (own rows only) but the Activity **page** requires `audit.view`, so Members never see “my activity.” (P1)
- `moves.approve` vs `approvals.manage` overlap is confusing: direct move needs `moves.approve`; the Approvals page needs `approvals.manage`. A Manager has both; a custom user might have one and not the other. (P1)
- Admin permissions modal is a no-op; you must change their role first. Easy to miss. (P3)

### Opportunities

- Hide or disable controls the user cannot actually call.
- “My activity” for every signed-in user.
- Permission presets for “Shop tablet” / “Mentor” / “Student.”
- Audit log of permission changes (currently user PUT is not activity-logged).

---

## 4. Dashboard

### Gaps

- **Done.** Dashboard pending list includes reimbursements and High POs, not only moves. Low-stock rows offer **Request purchase**. (was P1/P2)
- Low-stock / overdue / pending lists are not clickable into the record — only “View all” (except Request purchase). (P2)
- Finance charts include all time in spending-by-category but only 6 months for income vs expense — easy to misread. (P3)
- No “items in Poor condition” or “unknown location” cards even though those pages exist. (P2)
- Budget utilization uses current calendar month **plus annual budgets**; the label looks like “this month only.” (P2)

### Opportunities

- Click-through from every stat/list row.
- “Needs attention” inbox: low stock, overdue borrows, pending approvals (moves **and** reimbursements), Poor condition.
- Date-range control for finance charts.
- Packing / event countdown widget (see Inventory opportunities).

---

## 5. Inventory

### Gaps

- **Done.** Kit assemble/break decrements/restores BOM stock; nested kits rejected. (was P0)
- **Done.** Direct/approved moves update unit locations; stock remove takes `unitIds[]` or unused-first (not LIFO last N); unit location uses the Locations dropdown. (was P0/P1)
- Item-level condition update does not cascade to units. (P1)
- **Done.** Inventory CSV import/export (name, itemNumber, category, qty, minStock, condition, location, person, notes). Bulk Add is still manual rows. (was P1)
- **Done.** Print labels (Code128 of itemNumber or id; unit labels use `unitSku`). USB scanners type into search. (was P2)
- **No duplicate item**, no archive (only hard delete). (P2)
- **Single image, cannot remove it** (only replace). Attachments 4 MB vs receipts 10 MB. (P2)
- **Comments cannot be edited or deleted.** Any `inventory.view` user can comment, including Viewers. (P2)
- **Categories are hardcoded** in `constants.js`. Custom Fields hang off those names; you cannot add “CNC” or “FIRST” without a code change. (P1)
- Qty cannot be edited on the item form (intentional) but there is no “set quantity to N” — only +/- adjust. (P3)
- Filter chips only show 5 categories and 4 locations; the rest are unreachable except via search. (P2)

### Opportunities

- **Kit build/break:** assemble kit → decrement components; disassemble → return stock. Warn if components are short.
- **Unit picker on stock remove** and on borrow/move.
- CSV import/export of items (name, SKU, qty, min, location, condition, custom fields).
- Barcode labels (print sheet) + camera/USB scanner on search.
- Multi-image gallery; remove image.
- Archive instead of delete; restore from Activity.
- Tags in addition to a single category.
- “Clone item.”
- Serial-number field separate from item #.
- Low-stock **Create purchase request** one-click.

---

## 6. Whereabouts

### Gaps

- **Done.** Location rename/merge/delete rewrite item, unit, and pending-move location strings. (was P0)
- **Done.** Group header **Move all to…** (direct if `moves.approve`, else per-item requests). Groups parent then child; dated locations show when in range (or still hold items). (was P2)
- Direct move here requires a location; Inventory direct move allows “None” and the API keeps the previous location if you send empty. Three different behaviors. (P1)
- Unknown-location group has no “fix all” action. (P2)

### Opportunities

- Cascade rename/delete: pick a replacement location for affected items.
- Bulk move of a location group (trailer load-out).
- Map or shop-layout view (optional, later).
- “Assigned to person” directory grouped like locations.

---

## 7. Condition Tracker

### Gaps

- **Done.** Condition **Update** is hidden unless `inventory.edit` or (view and not Viewer). (was P0)
- Item-level condition is a single value — a 20-qty bin of “Good” cannot have 2 “Poor” units reflected on this page (units exist but this page ignores them). (P1)
- No filter by location/category. (P3)
- No “needs repair” queue, assignee, or parts-needed note beyond a free-text condition note. (P2)

### Opportunities

- Per-unit condition rollup (worst unit wins, or counts per grade).
- Repair tickets: Poor → assign mentor, mark fixed.
- Photo on condition update (broken chain, cracked bumper).

---

## 8. Purchases

### Gaps

- **Done.** Estimated cost, vendor, receive-into-item picker, receive location; on Received with cost, prompt to create a Finance Purchase transaction. (was P0)
- **Done.** High-priority POs from non-approvers land in `PendingApproval` until Approvals. (was P2)
- Receive still creates items as New / minStock 0 with no custom fields. (P1)
- Status is Needed → Ordered → Received plus PendingApproval / Denied. No Partial or Backordered. (P1)
- No attachment on the purchase itself (link URL only). (P2)
- Anyone with `purchases.edit` (including Members) can mark Received and mutate inventory without `inventory.edit`. (P1)
- **Done.** Hub receive-purchase screen (amount in the form; skips the web prompt). (was P1)

### Opportunities

- Estimated + actual cost; on Received, offer “create Purchase transaction.”
- Vendor field + URL; “Open vendor cart.”
- Explicit “Receive into item…” picker (use `linkedItemId`).
- Partial receive (ordered 50, got 20).
- Convert low-stock items into a shopping list.
- Approval workflow for High-priority / over-budget requests.

---

## 9. Borrows

### Gaps

- **Done.** Borrow `qty` + optional `unitIds`; parent `currentPerson` only if all units are out / qty==1. Delete of an active borrow restores person/units. (was P0/P1)
- Overdue is display-only — no reminder, no escalate, no dashboard badge count on the nav. (P2)
- Contact is free text; not linked to Team users. Internal borrows should pick a user. (P2)
- Return does not prompt for condition (“came back Poor”). (P2)

### Opportunities

- Check out N units / specific unit SKUs; item person/location becomes a derived “split” state.
- Due-date reminders on Dashboard + Hub.
- Condition-on-return.
- “Checked out to event trailer” as a borrow type vs person.
- Signature / photo of borrower (shop laptop).

---

## 10. Approvals

### Gaps

- **Done.** Approvals tabs Pending / History with Move / Reimburse / Purchase filters. Dashboard includes reimbursements + High POs. Deny reasons show on history. (was P1/P2)
- Busy/disable is per-id but a double-click can still race (no idempotency on browser API). (P3)

### Opportunities

- Unified inbox with filters: Move / Reimburse / (future) Purchase.
- History tab.
- Notify requester in-app (“your move was denied: trailer is full”).
- Batch approve.

---

## 11. Finance — Transactions

### Gaps

- **Done.** Deleting a transaction unwinds goal `currentAmount`, fundraiser `actualAmount` / donation row, and voids a linked approved reimbursement. (was P0)
- **Done.** Goal add-funds defaults to **Link Existing**; **New Transaction** warns that it adds income to the team balance. (was P0)
- No date-range, category, or amount filter (only type + text search). (P2)
- `linkedPurchaseId` is write-only in the form; the list does not show or navigate to the PO. (P1)
- Import cannot attach receipts as files (URL column only). (P3)
- Recurring transactions (monthly shop fee) do not exist. (P3)

### Opportunities

- Date range + category chips like Inventory.
- Show linked purchase / fundraiser / goal as badges with links.
- Warn when adding goal funds: “This will increase recorded income. Link existing instead?”
- On delete, offer to decrement the linked goal/fundraiser.
- Recurring donations / subscription sponsors.

---

## 12. Finance — Budget

### Gaps

- Actuals only sum transactions whose **category string exactly matches** the budget category. “Electronics” vs “Electronic” silently under-reports. (P1)
- Month blank = annual, but the viewer always picks a month — annual lines **repeat every month** and can look like 12× the yearly budget if you mentally sum months. (P1)
- No copy-forward (“duplicate last year’s budget”). (P2)
- Cannot attach a budget line to a savings goal. (P3)
- Chart empty state is OK; no export on this tab (only Reports). (P3)

### Opportunities

- Yearly vs monthly toggle that does not mix the two in one list.
- Clone year.
- Alert when a transaction posts to an over-budget category.
- Uncategorized expense bucket.

---

## 13. Finance — Savings Goals

### Gaps

- **Done.** Goal double-count warning + reverse-on-delete. Delete goal unlinks `linkedGoalId` and does not delete income rows. (was P0/P1)
- Completed goals still sit in the main list with no archive. **+ Funds** hides when complete, but you can Edit `currentAmount` back down. (P2)
- Deadline has no reminder. (P3)
- No contribution history on the card (must hunt transactions). (P2)

### Opportunities

- Transfer from balance (no new income).
- Goal ↔ budget link (“Robot parts fund spends from Mechanical”).
- Archive completed goals.

---

## 14. Finance — Reimbursements

### Gaps

- **Done.** Deleting an approved reimbursement voids/deletes the linked txn; deleting that txn marks the reimbursement voided. (was P0)
- Approvers see **Delete** on pending/approved/denied with no separate “void” label. (P1)
- Requester cannot cancel their own pending request (`delete` requires approve permission). (P1)
- Category is forced to `Reimbursement` on the generated txn, so it **never hits a budget line** like Travel/Food unless someone edits the transaction. (P1)
- Duplicate Approve/Deny UI: Approvals page **and** Finance → Reimbursements. Easy to miss one inbox. (P2)

### Opportunities

- Requester: cancel pending.
- Pick expense category (Travel vs Tools) so budgets move.
- Void = deny + reverse txn.
- Single inbox (Approvals) with Finance as the archive.

---

## 15. Finance — Fundraisers

### Gaps

- **Done.** Per-donation PUT/DELETE adjusts `actualAmount` and the linked txn. Delete fundraiser removes linked `FundraiserIncome` txns. (was P0)
- CSV import can link by name; renaming a fundraiser breaks future imports (no stable id in CSV). (P2)
- No volunteer / shift tracking (who worked the stand). (P3)

### Opportunities

- Per-entry edit/delete with txn reverse.
- Payout / “deposit to bank” that does not double-count.
- Import donations CSV on the fundraiser card.
- Public-ish “thermometer” image for social posts (export progress graphic).

---

## 16. Finance — Reports

### Gaps

- Exports are client-side from already-loaded data; no date filter, so “this season” is manual. (P2)
- No inventory valuation, no purchase-vs-spend reconciliation, no reimbursement aging. (P2)
- Donation export skips fundraisers with no `donations` array entries even if `actualAmount` was typed in. (P1)
- No PDF. (P3)

### Opportunities

- Season filter (e.g. “2026 build season”).
- “Purchases received this year vs Purchase transactions.”
- Inventory value if you add unit cost.
- Printable sponsor thank-you list from donations.

---

## 17. Activity and Audit

### Gaps

- **Finance, users, locations, fundraisers, Hub pairing are mostly absent from activity/audit.** Undo only covers four inventory mutations. Create/delete item cannot be undone (delete has a snapshot, but undo only restores `before` onto an existing item — it will 404). (P1)
- Two tabs that look similar; Activity has no `before`/`after` so you cannot see what changed. (P2)
- No CSV export of the log. (P3)
- Search does not include finance descriptions. (P3)

### Opportunities

- Single timeline with expand-to-diff.
- Undo create (re-insert) / undo delete (using the stored snapshot — the data is already in `before`).
- Log Team and Finance writes.
- Export for adult mentors / school audits.

---

## 18. Team

### Gaps

- **Done.** `/account` password + `mustChangePassword`. Team password reset still increments `tokenVersion`. (was P1/P2)
- Deleting a user does not reassign their comments, borrows, or reimbursements (orphan names remain). (P2)
- No disable/suspend — only delete. (P2)
- Changing role **resets custom permissions** without a confirm copy beyond the save. (P2)

### Opportunities

- Disable user (keep history).
- Last-login column.
- “Login as” not needed; “impersonate” would be dangerous — skip.
- Directory fields: email, phone, subteam (Mechanical / Software) for borrow contact.

---

## 19. Hub devices

### Gaps

- **Done.** `publicDevice()` includes `user_id` / `user_name`; Hub devices page shows the bound user. (was P1)
- No rename device, no last-IP, no “pending expired” cleanup UI. (P2)
- Pairing code input is maxLength 9 (`ABCD-EFGH`); fine unless the generator format changes. (P3)

### Opportunities

- Show bound user + scopes; re-bind without re-pair.
- Push a “shop mode” kiosk device with inventory-only scopes.

---

## 20. Custom Fields

### Gaps

- One definition **per category**; cannot share “Voltage” across Electronics and Sensors without duplicating. (P2)
- Types are only text / number / select — no date, checkbox, URL, barcode. (P2)
- Changing a field `name` (key) orphans existing `item.customFields` values. (P1)
- Not shown on list/grid cards — only in add/edit and Overview. Cannot filter/search by custom field. (P1)
- Not in Bulk Add. (P2)

### Opportunities

- Global field library + per-category enable.
- Filter inventory by custom field.
- Date type (calibration due) + dashboard “calibration overdue.”

---

## 21. Locations

### Gaps

- **Done.** Rename/merge cascade; one-level `parentId`; optional `startDate`/`endDate`; delete requires replacement or leave-as-text. (was P0/P2)
- Full Site → Room → Bin trees are still out of scope (one parent only). (P2 remaining)
- No address, notes, “this is the trailer” flag, or capacity. (P2)
- Members who can request moves cannot **see** the Locations admin page (`admin.locations` only). They still pick names from the dropdown via `GET /locations` with `inventory.view`. Fine, but they cannot add “Hotel ballroom” at an event. (P2)

### Opportunities

- Hierarchical locations (Site / Room / Bin).
- Event locations with start/end dates (competition venue as a **temporary location**, not a separate venues module).
- “Add location” from the move modal when permitted.
- Merge two location names.

---

## 22. Homelab Hub

### Gaps

- **Done.** Item forms prefill `{{nav.id}}`; Receive purchase, request/direct move, create reimbursement. (was P1/P2)
- No create-item, no locations admin, no fundraisers, no savings goals on Hub. Finance is still add-transaction plus reimbursement. (P2)
- Inventory search is list-filter only; USB scanners work on the web app, not Hub camera. (P2)

### Opportunities

- Pass `{{nav.id}}` into adjust-stock / condition forms (Mark Good already does).
- Add Receive purchase, Request move, Quick Total, Request reimbursement — the shop-floor actions.
- Scan barcode to open item.
- Offline queue (Hub protocol would need design).

---

## 23. Platform / ops

### Gaps

- **No in-app backup/restore** — README documents Docker volume copy only. (P2)
- Flat JSON + full-file rewrite: concurrent Hub + browser edits are serialized, but the file grows forever (activity/audit unbounded). (P2)
- **Almost no automated tests** besides `backend/test/hub.test.js`. AGENTS.md says there is no suite; Hub tests exist but CI/docs do not highlight them. Inventory/finance have none. (P1)
- No image remove; orphan upload files accumulate. (P3)
- `MAX_UNITS = 500` is silent on create (qty capped) but errors on adjust — inconsistent. (P3)
- No app-level version / changelog in the UI. (P3)

### Opportunities

- Admin “Download data.json” / “Restore.”
- Activity log retention / prune.
- Expand tests: purchase receive, location rename, goal add-funds, reimbursement approve.
- Health dashboard: data file size, upload count, last backup.

---

## Highest-leverage next features (recommended order)

These close the worst integrity holes **and** match how a robotics team actually works.

1. **Done.** Cascade location rename/merge and hide move/condition buttons the user cannot use. (P0)
2. **Done.** Purchase cost + receive-into-item picker + optional finance txn. (P0)
3. **Done.** Kit assemble/disassemble and unit-aware stock remove. (P0)
4. **Done.** Finance reverse-on-delete (transactions ↔ goals ↔ fundraisers ↔ reimbursements) and fix goal add-funds double-count. (P0)
5. **Done.** Fundraiser per-entry edit/delete. (P0)
6. **Done.** Borrow specific qty/units so person/location is not a single field. (P0)
7. **Done.** Inventory CSV import/export and low stock → purchase request. (P1/P2)
8. **Done.** Event load-out: bulk-move a location group. (P2)
9. **Done.** Global search deep-link + mobile More nav. (P1)
10. **Done.** Hub: receive purchase, nav.id on item forms, move, reimbursement. (P1)
11. **Calibration/repair due via custom date fields + dashboard.** Still out of scope. (P2)
12. **Done.** Printable barcode labels. (P2)

---

## Explicitly out of scope unless you want a different product

- Multi-team / SaaS tenancy
- Real-time collaborative cursors
- Full accounting package (GL, 1099s, tax)
- Customer storefront (this is a team ops tool)
- A separate “venues” CRUD — **event locations** should be Locations with a date range, not a new noun
