# Feature gaps and opportunities

Review of every module in Robotics Inventory against what the code actually does. Each section lists **gaps** (incomplete, inconsistent, or broken wiring of an existing feature) then **opportunities** (new capabilities that fit this product).

Severity: **P0** = data integrity / misleading numbers / permission hole. **P1** = existing feature is half-built. **P2** = high-value for a robotics team. **P3** = polish.

There is still no “venues” entity. Location and fundraiser gaps are called out in those sections.

---

## 1. App shell and global UX

### Gaps

- **Mobile bottom nav only shows the first 4 permitted items.** Team, Hub, Custom Fields, Locations, Activity, Finance, Approvals are easy to miss. (P1)
- **Global search never opens the record.** Enter/click only routes to `/inventory`, `/purchases`, or `/borrows` — not the item/purchase/borrow you picked. (P1)
- **Search coverage is narrow.** No finance, locations, users, reimbursements, or fundraisers. Failures on purchases/borrows fetches are swallowed, so inventory-only results look complete. (P1)
- **No in-app “My account”.** Members cannot change their own password; only Team (`admin.users`) can. (P1)
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

- **`GET /api/auth/usernames` is public** — names and roles of every account, no auth. Useful for the picker, but it enumerates the team. (P1)
- Default seed passwords (`admin123`, `changeme1`) with no forced-reset flag. (P1)
- No self-service password change, no password-strength meter beyond 6-character minimum. (P1)
- JWT also accepted as `?token=` query param (easy to leak in logs/Referer). (P2)
- No 2FA, no lockout beyond login rate limit, no session list. Hub devices can be revoked; browser sessions cannot. (P2)
- Login picker shows every user including Admins to anyone who can load `/login`. (P2)

### Opportunities

- Invite links instead of a public directory.
- Forced password change on first login.
- “Sign out all other sessions.”
- Optional PIN for shop tablets (the migration still mentions old `pin` fields).

---

## 3. Roles and permissions

### Gaps

- **Move-request button is shown to Viewers** (and anyone with `inventory.view`). Backend requires `moves.request`, so they get a toast error. Same for Condition **Update** (Viewers 403; Members with view can update even without `inventory.edit`). (P0)
- **Item Detail Edit/Delete only wired from Inventory.** Whereabouts and Condition open the same modal without `onEdit`/`onDelete`. (P1)
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

- **Pending reimbursements are missing.** Only pending **moves** appear, even though Approvals handles both. (P1)
- Low-stock / overdue / pending lists are not clickable into the record — only “View all.” (P2)
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

- **Kits are labels only.** Checking “This is a kit” and adding a BOM does not reserve, decrement, or validate component stock. You can kit items that are themselves kits (UI filters `!i.isKit` on add, backend does not). (P0)
- **Units drift from the parent item.**
  - Direct move / approved move updates `item.currentLocation` only — unit rows keep old locations. (P0)
  - Item-level condition update does not cascade to units. (P1)
  - Stock **remove** deletes the **last N units** (LIFO), not a chosen unit — can destroy the unit you meant to keep. (P0)
  - Unit location/person are free text, not the Locations dropdown. (P1)
- **No inventory import/export.** Finance has CSV; inventory does not. Bulk Add is manual rows only (no item #, min stock, notes, kits, custom fields). (P1)
- **No duplicate item**, no archive (only hard delete). (P2)
- **Single image, cannot remove it** (only replace). Attachments 4 MB vs receipts 10 MB. (P2)
- **Comments cannot be edited or deleted.** Any `inventory.view` user can comment, including Viewers. (P2)
- **Categories are hardcoded** in `constants.js`. Custom Fields hang off those names; you cannot add “CNC” or “FIRST” without a code change. (P1)
- Qty cannot be edited on the item form (intentional) but there is no “set quantity to N” — only +/- adjust. (P3)
- Filter chips only show 5 categories and 4 locations; the rest are unreachable except via search. (P2)
- No barcode / QR / scan-to-open. `unitSku` is `{itemId}-{n}`, not a friendly code. (P2)

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

- **Renaming a Location does not rewrite `item.currentLocation`.** Items stay on the old string and show as “Unknown location.” Deleting a location does the same on purpose, but rename is worse because the UI implies a rename. (P0)
- Direct move here requires a location; Inventory direct move allows “None” and the API keeps the previous location if you send empty. Three different behaviors. (P1)
- Moves do not update unit locations (same as Inventory). (P0)
- No bulk move (“move everything in this group to X”). (P2)
- Unknown-location group has no “fix all” action. (P2)

### Opportunities

- Cascade rename/delete: pick a replacement location for affected items.
- Bulk move of a location group (trailer load-out).
- Map or shop-layout view (optional, later).
- “Assigned to person” directory grouped like locations.

---

## 7. Condition Tracker

### Gaps

- **Update is shown to everyone**, including Viewers who will 403. (P0)
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

- **No price, vendor, needed-by date, or account code.** A “Purchases” module that cannot record cost cannot talk to Finance. Marking Received does **not** create a transaction. (P0 for team accounting workflow)
- **`linkedItemId` exists on the API and is used on receive, but the UI never sets it.** Receive matches by **name** (case-insensitive). Two different “CIM motor” SKUs will dump stock onto the first match. (P0)
- Receive creates items at **blank location, New, minStock 0**, no custom fields. (P1)
- Status is only Needed → Ordered → Received. No Cancelled, Partial, Backordered, Denied. (P1)
- No attachment on the purchase itself (link URL only). (P2)
- Anyone with `purchases.edit` (including Members) can mark Received and mutate inventory without `inventory.edit`. (P1)
- Hub implements `purchases.set_status` but the Hub purchases screen has **no status control**. (P1)

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

- **Borrowing does not reduce `totalQty`.** It only sets `currentPerson` on the **parent item**. Borrowing 1 of 10 wrenches marks the whole item as “with Jordan.” Second borrow is allowed up to qty, but location/person on the item is a single field — the UI cannot show two borrowers. (P0)
- No unit-level checkout (which physical radio). (P1)
- No qty-to-borrow field (always 1 conceptual loan against a count). (P1)
- Overdue is display-only — no reminder, no escalate, no dashboard badge count on the nav. (P2)
- Contact is free text; not linked to Team users. Internal borrows should pick a user. (P2)
- Delete of an active borrow does not restore `currentPerson`. (P1)
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

- Dashboard pending count is moves only; Approvals page mixes moves + reimbursements with no tab filter. (P2)
- Denied/approved history is not listed here (only pending). Mentors cannot see what they already decided without Activity. (P1)
- No purchase-request approval (purchases go live immediately). (P2)
- Deny reason is optional and not shown back to the requester except for reimbursements on the Finance tab (move denials are activity-only). (P2)
- Busy/disable is per-id but a double-click can still race (no idempotency on browser API). (P3)

### Opportunities

- Unified inbox with filters: Move / Reimburse / (future) Purchase.
- History tab.
- Notify requester in-app (“your move was denied: trailer is full”).
- Batch approve.

---

## 11. Finance — Transactions

### Gaps

- **Deleting a transaction does not unwind links.** Goal `currentAmount` and fundraiser `actualAmount` stay inflated. (P0)
- **Goal “New Transaction” creates extra Donation income** even when the money is already in the ledger — double-counts Net Balance. “Link Existing” is the correct path; the default mode is the dangerous one. (P0)
- No date-range, category, or amount filter (only type + text search). (P2)
- `linkedPurchaseId` is write-only in the form; the list does not show or navigate to the PO. (P1)
- Import cannot attach receipts as files (URL column only). (P3)
- No void/reversal — only delete. (P2)
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

- Double-count income (above). (P0)
- Delete goal does not unlink `linkedGoalId` on transactions. (P1)
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

- **Approving creates a transaction; deleting the reimbursement later does not delete or reverse that transaction.** (P0)
- Approvers see **Delete** on pending/approved/denied with no “void.” (P1)
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

- **Cannot edit or delete a single donation / quick-total.** Wrong $50 entry means delete the whole fundraiser or live with it. Manual edit of `actualAmount` **desyncs** from `donations[]` because PUT overwrites the number without touching entries. (P0)
- Delete fundraiser does **not** delete linked `FundraiserIncome` transactions — reports still show the money. (P0)
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

- No self-service anything (password, display name). (P1)
- Deleting a user does not reassign their comments, borrows, or reimbursements (orphan names remain). (P2)
- No disable/suspend — only delete. (P2)
- Changing role **resets custom permissions** without a confirm copy beyond the save. (P2)
- Cannot require password change. (P2)

### Opportunities

- Disable user (keep history).
- Last-login column.
- “Login as” not needed; “impersonate” would be dangerous — skip.
- Directory fields: email, phone, subteam (Mechanical / Software) for borrow contact.

---

## 19. Hub devices

### Gaps

- **Paired device list does not show bound user, scopes, or client version** even though the store has `user_id`. `publicDevice()` strips them. After “Act as Jordan,” you cannot see that on the page. (P1)
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

- **Rename does not cascade** (see Whereabouts). (P0)
- No parent/child (Room → Shelf → Bin). Robotics shops care about bin-level. (P2)
- No address, notes, “this is the trailer” flag, or capacity. (P2)
- Count is `currentLocation === name` exact match — rename/typo splits counts. (P0 related)
- Members who can request moves cannot **see** the Locations admin page (`admin.locations` only). They still pick names from the dropdown via `GET /locations` with `inventory.view`. Fine, but they cannot add “Hotel ballroom” at an event. (P2)

### Opportunities

- Hierarchical locations (Site / Room / Bin).
- Event locations with start/end dates (competition venue as a **temporary location**, not a separate venues module).
- “Add location” from the move modal when permitted.
- Merge two location names.

---

## 22. Homelab Hub

### Gaps

- **Item forms ask for raw Item ID / Borrow ID** instead of pickers from the list you just tapped. Native UI is clunky compared to the web app. (P1)
- **`purchases.set_status` is implemented but not on the purchases screen.** Cannot mark Received from the phone. (P1)
- No create-item, no locations, no fundraisers, no reimbursements request, no savings goals. Finance is add-transaction only. (P2)
- No move request / direct move on Hub. (P2)
- Home buttons still render labels even when dest screens were filtered empty? Manifest filters buttons by scope — OK. Home approvals list needs `read:approvals`. (OK)
- Inventory search is list-filter only; no barcode. (P2)

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

1. **Cascade location rename/merge** and hide move/condition buttons the user cannot use. (P0)
2. **Purchase cost + receive-into-item picker + optional finance txn.** (P0)
3. **Kit assemble/disassemble and unit-aware stock remove.** (P0)
4. **Finance reverse-on-delete** (transactions ↔ goals ↔ fundraisers ↔ reimbursements) and fix goal add-funds double-count. (P0)
5. **Fundraiser per-entry edit/delete.** (P0)
6. **Borrow specific qty/units** so person/location is not a single field. (P0)
7. **Inventory CSV import/export** and **low stock → purchase request.** (P1/P2)
8. **Event load-out:** bulk-move a location group to “Team Trailer” / competition, with a checklist. (P2)
9. **Global search deep-link** + mobile More nav. (P1)
10. **Hub: status on purchases, nav.id on item forms, quick reimbursement.** (P1)
11. **Calibration/repair due via custom date fields + dashboard.** (P2)
12. **Printable barcode labels.** (P2)

---

## Explicitly out of scope unless you want a different product

- Multi-team / SaaS tenancy
- Real-time collaborative cursors
- Full accounting package (GL, 1099s, tax)
- Customer storefront (this is a team ops tool)
- A separate “venues” CRUD — **event locations** should be Locations with a date range, not a new noun
