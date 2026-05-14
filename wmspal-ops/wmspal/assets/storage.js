(function () {
  const STORAGE_KEY = "wmspal.ops.state.v1";
  const SUPABASE_URL = "https://zbtcwzpdhjxjemxbepsx.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidGN3enBkaGp4amVteGJlcHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODgyMjMsImV4cCI6MjA5NDM2NDIyM30.RI9ZrfLCWJRl6sXKq44GN2Gio09VB9amnkyvlGGAAmU";
  const TABLE = "app_state";
  const STATE_KEY = "salpal_state";

  // ── SUPABASE SYNC ─────────────────────────────────────────────────────
  let syncTimeout = null;

  const notifySyncStatus = (status, msg) => {
    window.dispatchEvent(new CustomEvent("wmspal:sync-status", { detail: { status, msg } }));
  };

  const syncToSupabase = (state) => {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      notifySyncStatus("syncing");
      try {
        const value = JSON.stringify(state);
        const now = new Date().toISOString();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Prefer": "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({ key: STATE_KEY, value, updated_at: now }),
        });
        if (res.ok || res.status === 201 || res.status === 204) {
          notifySyncStatus("ok");
        } else {
          const errText = await res.text();
          console.error("Supabase save error:", res.status, errText);
          notifySyncStatus("error", `${res.status}: ${errText}`);
        }
      } catch (err) {
        console.error("Supabase sync error:", err);
        notifySyncStatus("error", err.message);
      }
    }, 1500);
  };

  const loadFromSupabase = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?key=eq.${STATE_KEY}&select=value,updated_at`, {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Supabase load error:", res.status, err);
        notifySyncStatus("error");
        return null;
      }
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].value) {
        const data = JSON.parse(rows[0].value);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        notifySyncStatus("ok");
        return data;
      }
    } catch (err) {
      console.error("Supabase load error:", err);
      notifySyncStatus("error", err.message);
    }
    return null;
  };

  const makeId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const makeAwb = (state) => {
    const nums = (state.tasks || [])
      .map((t) => { const m = (t.awb || "").match(/^WMS-(\d+)$/); return m ? parseInt(m[1], 10) : 0; })
      .filter((n) => n > 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1001;
    return `WMS-${next}`;
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const addDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const nowStamp = () => new Date().toISOString();

  const seed = () => {
    const adminId = "user_admin";
    const driverA = "user_driver_ana";
    const driverB = "user_driver_ben";
    const companies = [
      { id: "company_greenmarket", name: "Greenmarket Foods", address: "14 Porter Street", city: "Birmingham", postcode: "B5 6AB" },
      { id: "company_fleetcare", name: "Fleetcare Parts", address: "77 Wharf Road", city: "Manchester", postcode: "M17 1HH" },
      { id: "company_northline", name: "Northline Medical", address: "8 Abbey Lane", city: "Leeds", postcode: "LS2 7JT" },
      { id: "company_cityprint", name: "City Print Works", address: "21 Station Approach", city: "London", postcode: "E2 8AA" },
    ];

    const createdAt = nowStamp();
    const taskOne = {
      id: "task_1001", awb: "WMS-1001", orderReference: "ORD-48021",
      orderDate: todayIso(), deliveryDate: addDays(1), driverId: driverA,
      type: "Delivery", deliveryTimeFrom: "09:00", deliveryTimeTo: "11:00", qty: 6,
      driverNotes: "Use goods entrance on Porter Street.",
      companyId: companies[0].id, companyName: companies[0].name, companyAddress: companies[0].address,
      city: companies[0].city, postcode: companies[0].postcode,
      status: "Open", proof: null, createdAt, updatedAt: createdAt,
      history: [{ id: makeId("history"), at: createdAt, actorId: adminId, actorName: "Mira Patel", action: "Created task", changes: ["Task created for Greenmarket Foods"] }],
    };
    const taskTwo = {
      id: "task_1002", awb: "WMS-1002", orderReference: "RET-2179",
      orderDate: todayIso(), deliveryDate: addDays(2), driverId: driverB,
      type: "Collection", deliveryTimeFrom: "11:00", deliveryTimeTo: "13:00", qty: 2,
      driverNotes: "Collect two sealed cartons from reception.",
      companyId: companies[1].id, companyName: companies[1].name, companyAddress: companies[1].address,
      city: companies[1].city, postcode: companies[1].postcode,
      status: "Open", proof: null, createdAt, updatedAt: createdAt,
      history: [{ id: makeId("history"), at: createdAt, actorId: adminId, actorName: "Mira Patel", action: "Created task", changes: ["Task created for Fleetcare Parts"] }],
    };
    const taskThree = {
      id: "task_1003", awb: "WMS-1003", orderReference: "ORD-48022",
      orderDate: todayIso(), deliveryDate: todayIso(), driverId: driverA,
      type: "Delivery", deliveryTimeFrom: "14:00", deliveryTimeTo: "16:00", qty: 3,
      driverNotes: "",
      companyId: companies[2].id, companyName: companies[2].name, companyAddress: companies[2].address,
      city: companies[2].city, postcode: companies[2].postcode,
      status: "Open", proof: null, createdAt, updatedAt: createdAt,
      history: [{ id: makeId("history"), at: createdAt, actorId: adminId, actorName: "Mira Patel", action: "Created task", changes: ["Task created for Northline Medical"] }],
    };

    return {
      users: [
        { id: adminId, firstName: "Mira", lastName: "Patel", username: "admin", password: "admin123", role: "Admin" },
        { id: driverA, firstName: "Ana", lastName: "Kovac", username: "ana.driver", password: "driver123", role: "Driver" },
        { id: driverB, firstName: "Ben", lastName: "Carter", username: "ben.driver", password: "driver123", role: "Driver" },
      ],
      companies,
      tasks: [taskOne, taskTwo, taskThree],
      currentAdminId: adminId,
      selectedDriverId: "",
    };
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const loadState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { const f = seed(); localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); return f; }
    try {
      const s = JSON.parse(raw);
      return {
        users: Array.isArray(s.users) ? s.users : [],
        companies: Array.isArray(s.companies) ? s.companies : [],
        tasks: Array.isArray(s.tasks) ? s.tasks : [],
        currentAdminId: s.currentAdminId || "user_admin",
        selectedDriverId: s.selectedDriverId || "",
      };
    } catch { const f = seed(); localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); return f; }
  };

  const saveState = (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncToSupabase(state);
    window.dispatchEvent(new CustomEvent("wmspal:state-saved"));
  };

  const getUserName = (state, userId) => {
    const u = state.users.find((x) => x.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : "Unassigned";
  };

  const getDrivers = (state) => state.users.filter((u) => u.role === "Driver");
  const getAdmins = (state) => state.users.filter((u) => u.role === "Admin");

  const formatDate = (iso) => {
    if (!iso) return "Not set";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (iso) => {
    if (!iso) return "Not set";
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  };

  const addressLine = (task) => [task.companyAddress, task.city, task.postcode].filter(Boolean).join(", ");
  const describeTaskAddress = (task) => `${task.companyName}, ${addressLine(task)}`;

  const createHistory = (state, actorId, action, changes) => ({
    id: makeId("history"), at: nowStamp(), actorId,
    actorName: getUserName(state, actorId),
    action, changes: changes.length ? changes : ["No field changes recorded"],
  });

  const labels = {
    awb: "AWB", orderReference: "Order reference", orderDate: "Order date",
    deliveryDate: "Delivery date", driverId: "Driver", type: "Type",
    deliveryTimeFrom: "Delivery time from", deliveryTimeTo: "Delivery time to",
    qty: "Qty (pallets)", driverNotes: "Notes to the driver",
    companyId: "Company", companyName: "Company name", companyAddress: "Company address",
    city: "City", postcode: "Postcode", status: "Status",
  };

  const displayValue = (state, key, value) => {
    if (key === "driverId") return value ? getUserName(state, value) : "Unassigned";
    if (key === "companyId") { const c = state.companies.find((x) => x.id === value); return c ? c.name : "None"; }
    if (key === "orderDate" || key === "deliveryDate") return formatDate(value);
    return value || "Blank";
  };

  const diffTask = (state, before, after) => {
    const keys = ["awb","orderReference","orderDate","deliveryDate","driverId","type","deliveryTimeFrom","deliveryTimeTo","qty","driverNotes","companyId","companyName","companyAddress","city","postcode","status"];
    return keys.filter((k) => (before[k]||"") !== (after[k]||"")).map((k) => `${labels[k]} changed from ${displayValue(state,k,before[k])} to ${displayValue(state,k,after[k])}`);
  };

  const upsertTask = (state, task, actorId) => {
    const idx = state.tasks.findIndex((x) => x.id === task.id);
    const at = nowStamp();
    if (idx === -1) {
      const created = { ...task, id: task.id || makeId("task"), status: task.status||"Open", proof: null, createdAt: at, updatedAt: at, history: [createHistory(state, actorId, "Created task", [`Task created for ${task.companyName}`])] };
      state.tasks.unshift(created); return created;
    }
    const cur = state.tasks[idx];
    const updated = { ...cur, ...task, updatedAt: at };
    const changes = diffTask(state, cur, updated);
    if (changes.length) updated.history = [createHistory(state, actorId, "Updated task", changes), ...(cur.history||[])];
    state.tasks[idx] = updated; return updated;
  };

  const startTask = (state, taskId, driverId) => {
    const idx = state.tasks.findIndex((t) => t.id === taskId); if (idx === -1) return null;
    const task = state.tasks[idx];
    const at = nowStamp();
    const updated = { ...task, status: "In Progress", updatedAt: at, history: [createHistory(state, driverId, "Started task", ["Task marked as In Progress"]), ...(task.history||[])] };
    state.tasks[idx] = updated; return updated;
  };

  const completeTask = (state, taskId, driverId, proof) => {
    const idx = state.tasks.findIndex((t) => t.id === taskId); if (idx === -1) return null;
    const task = state.tasks[idx];
    const completedAt = nowStamp();
    const updated = {
      ...task, status: "Completed", proof: { ...proof, completedAt }, updatedAt: completedAt,
      history: [createHistory(state, driverId, "Completed task", [`Proof submitted by ${proof.recipientName}`, proof.attachmentName ? `Attachment: ${proof.attachmentName}` : "No attachment"]), ...(task.history||[])],
    };
    state.tasks[idx] = updated; return updated;
  };

  // Sync company changes to all open/in-progress tasks
  const syncCompanyToTasks = (state, company) => {
    state.tasks.forEach((t) => {
      if (t.companyId === company.id && t.status !== "Completed") {
        t.companyName = company.name;
        t.companyAddress = company.address || "";
        t.city = company.city || "";
        t.postcode = company.postcode || "";
        t.updatedAt = nowStamp();
      }
    });
  };

  window.WMSPalStore = {
    loadState, saveState, makeId, makeAwb, clone, nowStamp,
    getUserName, getDrivers, getAdmins, formatDate, formatDateTime,
    addressLine, describeTaskAddress, upsertTask, startTask, completeTask, syncCompanyToTasks,
    loadFromSheets: loadFromSupabase,
  };
})();
