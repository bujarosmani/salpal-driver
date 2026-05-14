# WMSPal Ops

Static admin and driver operations app — rebuilt from SalPal Ops with a new dark industrial aesthetic.

## Run locally

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Open:
- Admin web app: `http://127.0.0.1:5173/admin.html`
- Driver mobile app: `http://127.0.0.1:5173/driver.html`

## Architecture

- Data stored in browser `localStorage` under `wmspal.ops.state.v1`
- Admin and driver share the same storage when served from the same origin
- Seed data: 1 admin, 2 drivers, 4 companies, 2 sample tasks

## Implemented flows

All features from SalPal Ops are carried over:
- User management (create, edit, delete admins and drivers)
- Task management (AWB, order ref, dates, type, company, address, driver assignment)
- Task detail view with timeline
- Driver calendar (month view, per-driver filter, hover tooltips)
- Driver mobile app (task list, detail, proof capture, signature, attachment, success)

## Design

Dark industrial theme — charcoal backgrounds, amber accents, DM Mono for data, Syne for headings.
Ready to extend with warehouse and purchasing modules.
