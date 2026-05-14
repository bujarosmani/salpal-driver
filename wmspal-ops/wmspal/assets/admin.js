(function () {
  const store = window.WMSPalStore;
  let state = store.loadState();
  let activeSection = "users";
  let selectedTaskId = "";
  let companyDialogSource = "";
  let calRangeFrom = "";
  let calRangeTo = "";
  let calSelectedDrivers = null;
  let calMonthValue = new Date().toISOString().slice(0, 7);

  // Sort state per table: { col, dir } dir = 'asc'|'desc'
  let sortState = { users: { col: "firstName", dir: "asc" }, companies: { col: "name", dir: "asc" }, tasks: { col: "awb", dir: "desc" } };

  // Task filters
  let taskDateFrom = "";
  let taskDateTo = "";
  let taskSelectedDrivers = null; // null = all
  let taskSelectedStatuses = null; // null = all

  const byId = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (v) => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const pluralize = (n,s,p=`${s}s`) => `${n} ${n===1?s:p}`;
  const openModal = (d) => { if (!d.open) d.showModal(); };
  const closeModal = (d) => { if (d.open) d.close(); };
  const clearInvalid = (form) => form.querySelectorAll("[aria-invalid='true']").forEach((e)=>e.removeAttribute("aria-invalid"));
  const markInvalid = (ids) => ids.forEach((id)=>{ const e=byId(id); if(e) e.setAttribute("aria-invalid","true"); });
  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const persist = () => store.saveState(state);

  const currentAdminId = () => {
    if (state.users.some((u)=>u.id===state.currentAdminId&&u.role==="Admin")) return state.currentAdminId;
    const f = store.getAdmins(state)[0]; return f ? f.id : "";
  };

  const driverOpts = () => store.getDrivers(state).map((d)=>({value:d.id,label:`${d.firstName} ${d.lastName}`}));

  const selectOptions = (opts, sel, empty) => {
    const e = empty ? `<option value="">${esc(empty)}</option>` : "";
    return e + opts.map((o)=>`<option value="${esc(o.value)}"${o.value===sel?" selected":""}>${esc(o.label)}</option>`).join("");
  };

  const driverSelectHtml = (sel, label="Unassigned") => selectOptions(driverOpts(), sel, label);

  const setSection = (section) => {
    activeSection = section;
    const titles = {users:"Users",companies:"Companies",tasks:"Tasks",calendar:"Driver calendar"};
    byId("sectionTitle").textContent = titles[section];
    qsa(".nav-item").forEach((i)=>i.classList.toggle("active",i.dataset.section===section));
    qsa(".content-section").forEach((p)=>p.classList.remove("active"));
    byId(`${section}Section`).classList.add("active");
    // Reset all filters on every tab switch
    taskDateFrom=""; taskDateTo=""; taskSelectedDrivers=null; taskSelectedStatuses=null;
    calRangeFrom=""; calRangeTo=""; calSelectedDrivers=null;
    if(section==="tasks"){ renderTaskFilters(); renderTasks(); }
    if(section==="calendar") renderCalendar();
  };

  const renderIdentity = () => { byId("adminName").textContent = store.getUserName(state, currentAdminId()); };

  const hydrateTaskFormDriverSelect = () => {
    const s = byId("taskDriverId"); if (!s) return;
    const current = s.value;
    s.innerHTML = driverSelectHtml(current, "Unassigned");
  };

  // ── SORT HELPERS ──────────────────────────────────────────────────────
  const sortIcon = (table, col) => {
    const s = sortState[table];
    if (s.col !== col) return `<span class="sort-icon">↕</span>`;
    return s.dir === "asc" ? `<span class="sort-icon active">↑</span>` : `<span class="sort-icon active">↓</span>`;
  };

  const toggleSort = (table, col) => {
    const s = sortState[table];
    if (s.col === col) s.dir = s.dir === "asc" ? "desc" : "asc";
    else { s.col = col; s.dir = "asc"; }
  };

  const sortArr = (arr, col, dir) => {
    return [...arr].sort((a, b) => {
      const av = String(a[col]||"").toLowerCase();
      const bv = String(b[col]||"").toLowerCase();
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  };

  // ── USERS ─────────────────────────────────────────────────────────────
  const renderUsers = () => {
    const s = sortState.users;
    const users = sortArr(state.users, s.col, s.dir);
    byId("usersSummary").textContent = `${pluralize(users.length,"user")} total`;
    byId("usersTable").innerHTML = `
      <thead><tr>
        <th class="sortable" data-table="users" data-col="firstName">Name ${sortIcon("users","firstName")}</th>
        <th class="sortable" data-table="users" data-col="username">Username ${sortIcon("users","username")}</th>
        <th class="sortable" data-table="users" data-col="role">Role ${sortIcon("users","role")}</th>
        <th class="right">Actions</th>
      </tr></thead>
      <tbody>${users.map((u)=>`
        <tr>
          <td><div class="entity-cell">
            <span class="avatar">${esc(u.firstName[0]||"")}${esc(u.lastName[0]||"")}</span>
            <div><strong>${esc(u.firstName)} ${esc(u.lastName)}</strong><small>${esc(u.role==="Driver"?"Driver account":"Admin account")}</small></div>
          </div></td>
          <td>${esc(u.username)}</td>
          <td><span class="role-chip ${u.role==="Admin"?"admin":"driver"}">${esc(u.role)}</span></td>
          <td class="right action-cell">
            <button class="table-action" type="button" data-edit-user="${esc(u.id)}">Edit</button>
            <button class="table-action" type="button" data-reset-pw="${esc(u.id)}">Reset password</button>
            <button class="table-action danger" type="button" data-delete-user="${esc(u.id)}">Delete</button>
          </td>
        </tr>`).join("")||`<tr><td colspan="4" class="empty-table">No users yet.</td></tr>`}
      </tbody>`;
    bindSortHeaders(byId("usersTable"), "users", renderUsers);
  };

  const resetUserForm = () => {
    byId("userForm").reset(); clearInvalid(byId("userForm"));
    byId("userId").value=""; byId("userFormHeading").textContent="Create user"; byId("userFormError").textContent="";
    byId("password").required=true; byId("confirmPassword").required=true; byId("role").value="Driver";
    openModal(byId("userDialog")); byId("firstName").focus();
  };

  const editUser = (id) => {
    const u=state.users.find((x)=>x.id===id); if(!u) return;
    clearInvalid(byId("userForm"));
    byId("userId").value=u.id; byId("firstName").value=u.firstName; byId("lastName").value=u.lastName;
    byId("username").value=u.username; byId("role").value=u.role;
    byId("password").value=""; byId("confirmPassword").value="";
    byId("password").required=false; byId("confirmPassword").required=false;
    byId("userFormHeading").textContent="Edit user"; byId("userFormError").textContent="";
    openModal(byId("userDialog")); byId("firstName").focus();
  };

  const openResetPwDialog = (id) => {
    const u=state.users.find((x)=>x.id===id); if(!u) return;
    byId("resetPwUserId").value=id;
    byId("resetPwHeading").textContent=`Reset password — ${u.firstName} ${u.lastName}`;
    byId("resetPwError").textContent="";
    byId("resetPwForm").reset();
    openModal(byId("resetPwDialog")); byId("newPassword").focus();
  };

  const saveResetPw = (e) => {
    e.preventDefault();
    const id=byId("resetPwUserId").value;
    const np=byId("newPassword").value;
    const cp=byId("confirmNewPassword").value;
    if(np.length<6){byId("resetPwError").textContent="Password must be at least 6 characters.";return;}
    if(np!==cp){byId("resetPwError").textContent="Passwords must match.";return;}
    const i=state.users.findIndex((u)=>u.id===id);
    if(i!==-1) state.users[i].password=np;
    persist(); closeModal(byId("resetPwDialog")); renderAll();
  };

  const validateUser = (d) => {
    const m=[];
    if(!d.firstName) m.push("firstName"); if(!d.lastName) m.push("lastName");
    if(!d.username) m.push("username"); if(!d.role) m.push("role");
    if(!d.id&&!d.password) m.push("password"); if(!d.id&&!d.confirmPassword) m.push("confirmPassword");
    if(m.length) return {message:"Please complete all required fields.",ids:m};
    if(d.password||d.confirmPassword){
      if(d.password.length<6) return {message:"Password must be at least 6 characters.",ids:["password"]};
      if(d.password!==d.confirmPassword) return {message:"Passwords must match.",ids:["password","confirmPassword"]};
    }
    if(state.users.some((u)=>u.username.toLowerCase()===d.username.toLowerCase()&&u.id!==d.id))
      return {message:"Username already in use.",ids:["username"]};
    return null;
  };

  const saveUser = (e) => {
    e.preventDefault(); clearInvalid(byId("userForm"));
    const d={id:byId("userId").value,firstName:byId("firstName").value.trim(),lastName:byId("lastName").value.trim(),
      username:byId("username").value.trim(),password:byId("password").value,
      confirmPassword:byId("confirmPassword").value,role:byId("role").value};
    const err=validateUser(d); if(err){byId("userFormError").textContent=err.message;markInvalid(err.ids);return;}
    if(d.id){
      const i=state.users.findIndex((u)=>u.id===d.id);
      if(i!==-1){
        const ex=state.users[i];
        if(ex.role==="Admin"&&d.role!=="Admin"&&state.users.filter((u)=>u.role==="Admin"&&u.id!==d.id).length===0){
          byId("userFormError").textContent="At least one admin must remain."; markInvalid(["role"]); return;
        }
        state.users[i]={...ex,firstName:d.firstName,lastName:d.lastName,username:d.username,role:d.role,password:d.password||ex.password};
        if(ex.role==="Driver"&&d.role!=="Driver") unassignDriver(d.id,`${ex.firstName} ${ex.lastName}`);
      }
    } else {
      state.users.push({id:store.makeId("user"),firstName:d.firstName,lastName:d.lastName,username:d.username,password:d.password,role:d.role});
    }
    persist(); closeModal(byId("userDialog")); renderAll();
  };

  const unassignDriver = (driverId, name) => {
    state.tasks.filter((t)=>t.driverId===driverId).forEach((t)=>{
      t.driverId=""; t.updatedAt=store.nowStamp();
      t.history=[{id:store.makeId("history"),at:store.nowStamp(),actorId:currentAdminId(),actorName:store.getUserName(state,currentAdminId()),action:"Updated task",changes:[`Driver changed from ${name} to Unassigned`]},...(t.history||[])];
    });
  };

  const deleteUser = (id) => {
    const u=state.users.find((x)=>x.id===id); if(!u) return;
    if(u.role==="Admin"&&state.users.filter((x)=>x.role==="Admin"&&x.id!==id).length===0){alert("At least one admin must remain.");return;}
    if(!confirm(`Delete ${u.firstName} ${u.lastName}?`)) return;
    state.users=state.users.filter((x)=>x.id!==id);
    unassignDriver(id,`${u.firstName} ${u.lastName}`);
    persist(); renderAll();
  };

  // ── COMPANIES ─────────────────────────────────────────────────────────
  const renderCompanies = () => {
    const s = sortState.companies;
    const companies = sortArr(state.companies, s.col, s.dir);
    byId("companiesSummary").textContent=`${pluralize(companies.length,"company","companies")} total`;
    byId("companiesTable").innerHTML=`
      <thead><tr>
        <th class="sortable" data-table="companies" data-col="name">Company ${sortIcon("companies","name")}</th>
        <th class="sortable" data-table="companies" data-col="address">Address ${sortIcon("companies","address")}</th>
        <th class="sortable" data-table="companies" data-col="city">City ${sortIcon("companies","city")}</th>
        <th class="sortable" data-table="companies" data-col="postcode">Postcode ${sortIcon("companies","postcode")}</th>
        <th class="right">Actions</th>
      </tr></thead>
      <tbody>${companies.map((c)=>`
        <tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.address||"—")}</td>
          <td>${esc(c.city||"—")}</td>
          <td>${esc(c.postcode||"—")}</td>
          <td class="right action-cell">
            <button class="table-action" type="button" data-edit-company="${esc(c.id)}">Edit</button>
            <button class="table-action danger" type="button" data-delete-company="${esc(c.id)}">Delete</button>
          </td>
        </tr>`).join("")||`<tr><td colspan="5" class="empty-table">No companies yet.</td></tr>`}
      </tbody>`;
    bindSortHeaders(byId("companiesTable"), "companies", renderCompanies);
  };

  const openCompanyForm = (company=null, source="") => {
    companyDialogSource=source;
    byId("companyForm").reset(); clearInvalid(byId("companyForm")); byId("companyFormError").textContent="";
    if(company){
      byId("companyFormId").value=company.id; byId("companyFormName").value=company.name;
      byId("companyFormAddress").value=company.address||""; byId("companyFormCity").value=company.city||""; byId("companyFormPostcode").value=company.postcode||"";
      byId("companyFormHeading").textContent="Edit company"; byId("deleteCompanyButton").hidden=false;
    } else {
      byId("companyFormId").value=""; byId("companyFormHeading").textContent="Add company"; byId("deleteCompanyButton").hidden=true;
      if(source==="taskForm"&&byId("companySearch")) byId("companyFormName").value=byId("companySearch").value.trim();
    }
    openModal(byId("companyDialog")); byId("companyFormName").focus();
  };

  const validateCompanyForm = () => {
    clearInvalid(byId("companyForm"));
    const missing=[];
    if(!byId("companyFormName").value.trim()) missing.push("companyFormName");
    if(!byId("companyFormCity").value.trim()) missing.push("companyFormCity");
    if(!byId("companyFormPostcode").value.trim()) missing.push("companyFormPostcode");
    if(missing.length){byId("companyFormError").textContent="Company name, city and postcode are required.";markInvalid(missing);return false;}
    return true;
  };

  const saveCompany = (e) => {
    e.preventDefault(); if(!validateCompanyForm()) return;
    const id=byId("companyFormId").value;
    const draft={id:id||store.makeId("company"),name:byId("companyFormName").value.trim(),address:byId("companyFormAddress").value.trim(),city:byId("companyFormCity").value.trim(),postcode:byId("companyFormPostcode").value.trim()};
    if(id){ const i=state.companies.findIndex((c)=>c.id===id); if(i!==-1) state.companies[i]=draft; }
    else state.companies.push(draft);
    // Sync to open tasks
    store.syncCompanyToTasks(state, draft);
    persist();
    const fromTask=companyDialogSource==="taskForm";
    companyDialogSource="";
    closeModal(byId("companyDialog"));
    renderAll();
    if(fromTask) hydrateCompanySearch(draft.id);
  };

  const deleteCompany = () => {
    const id=byId("companyFormId").value;
    const c=state.companies.find((x)=>x.id===id); if(!c) return;
    const inUse=state.tasks.some((t)=>t.companyId===id);
    if(!confirm(inUse?`"${c.name}" is used in tasks. Delete anyway?`:`Delete "${c.name}"?`)) return;
    state.companies=state.companies.filter((x)=>x.id!==id);
    persist(); closeModal(byId("companyDialog")); renderAll();
  };

  // ── COMPANY AUTOCOMPLETE ──────────────────────────────────────────────
  let dropFocusIdx=-1;

  const hydrateCompanySearch = (selectId="") => {
    const cs=byId("companySearch"); if(!cs) return;
    if(selectId){
      state=store.loadState();
      const c=state.companies.find((x)=>x.id===selectId);
      byId("companyId").value=selectId;
      cs.value=c?c.name:"";
      fillAddressFromCompany(selectId);
    }
    closeDropdown();
    updateEditCompanyBtn();
  };

  const fillAddressFromCompany = (id) => {
    const c=state.companies.find((x)=>x.id===id); if(!c) return;
    byId("companyAddress").value=c.address||"";
    byId("city").value=c.city||"";
    byId("postcode").value=c.postcode||"";
  };

  const updateEditCompanyBtn = () => {
    const b=byId("editSelectedCompany"); if(b) b.hidden=!byId("companyId").value;
  };

  const closeDropdown = () => {
    const dd=byId("companyDropdown"); if(!dd) return;
    dd.innerHTML=""; dd.classList.remove("open"); dropFocusIdx=-1;
  };

  const renderDropdown = (query) => {
    state=store.loadState();
    const dd=byId("companyDropdown"); if(!dd) return;
    const q=query.trim().toLowerCase();
    const matches=state.companies.filter((c)=>c.name.toLowerCase().includes(q));
    let html=matches.map((c)=>`<button type="button" class="company-option" data-company-id="${esc(c.id)}">${esc(c.name)}<span style="color:var(--muted);font-size:0.78rem;display:block;">${esc([c.city,c.postcode].filter(Boolean).join(", "))}</span></button>`).join("");
    if(q&&!state.companies.some((c)=>c.name.toLowerCase()===q))
      html+=`<button type="button" class="company-option add-new" data-add-new="1">+ Add "${esc(query.trim())}" as new company</button>`;
    if(!html) html=`<div class="company-option" style="cursor:default;color:var(--muted);">No companies found</div>`;
    dd.innerHTML=html; dd.classList.add("open"); dropFocusIdx=-1;
  };

  const bindCompanySearch = () => {
    const cs=byId("companySearch"); if(!cs) return;
    const dd=byId("companyDropdown");
    cs.addEventListener("input",()=>{ byId("companyId").value=""; updateEditCompanyBtn(); if(!cs.value.trim()){closeDropdown();return;} renderDropdown(cs.value); });
    cs.addEventListener("focus",()=>{ if(cs.value.trim()) renderDropdown(cs.value); });
    cs.addEventListener("keydown",(e)=>{
      const opts=Array.from(dd.querySelectorAll(".company-option:not([style*='cursor:default'])"));
      if(!dd.classList.contains("open")||!opts.length) return;
      if(e.key==="ArrowDown"){e.preventDefault();dropFocusIdx=Math.min(dropFocusIdx+1,opts.length-1);opts.forEach((o,i)=>o.classList.toggle("focused",i===dropFocusIdx));}
      else if(e.key==="ArrowUp"){e.preventDefault();dropFocusIdx=Math.max(dropFocusIdx-1,0);opts.forEach((o,i)=>o.classList.toggle("focused",i===dropFocusIdx));}
      else if(e.key==="Enter"){e.preventDefault();if(dropFocusIdx>=0)opts[dropFocusIdx].click();}
      else if(e.key==="Escape") closeDropdown();
    });
    dd.addEventListener("click",(e)=>{
      const opt=e.target.closest("[data-company-id]"); const addNew=e.target.closest("[data-add-new]");
      if(opt) hydrateCompanySearch(opt.dataset.companyId);
      if(addNew){openCompanyForm(null,"taskForm");closeDropdown();}
    });
    document.addEventListener("click",(e)=>{ if(!cs.contains(e.target)&&!dd.contains(e.target)) closeDropdown(); });
    const editBtn=byId("editSelectedCompany");
    if(editBtn) editBtn.addEventListener("click",()=>{ const c=state.companies.find((x)=>x.id===byId("companyId").value); if(c) openCompanyForm(c,"taskForm"); });
  };

  // ── DATE RANGE PICKER ─────────────────────────────────────────────────
  let pickerCallback = null;
  let pickerFrom = "";
  let pickerTo = "";
  let pickerViewMonth = new Date().toISOString().slice(0,7); // YYYY-MM

  const openDatePicker = (currentFrom, currentTo, callback) => {
    pickerCallback = callback;
    pickerFrom = currentFrom;
    pickerTo = currentTo;
    pickerViewMonth = currentFrom ? currentFrom.slice(0,7) : new Date().toISOString().slice(0,7);
    renderDatePicker();
    openModal(byId("datePickerDialog"));
  };

  const renderDatePicker = () => {
    const container = byId("datePickerContent"); if(!container) return;
    const [y1, m1] = pickerViewMonth.split("-").map(Number);
    const m2 = m1 === 12 ? 1 : m1 + 1;
    const y2 = m1 === 12 ? y1 + 1 : y1;
    const todayStr = new Date().toISOString().slice(0,10);

    const buildCal = (year, month) => {
      const firstDay = new Date(year, month-1, 1);
      const lastDay = new Date(year, month, 0);
      const offset = (firstDay.getDay() + 6) % 7;
      const totalCells = Math.ceil((offset + lastDay.getDate()) / 7) * 7;
      const monthStr = `${year}-${String(month).padStart(2,"0")}`;
      const monthName = new Date(year, month-1, 1).toLocaleString("en-GB",{month:"long",year:"numeric"});

      let cells = "";
      for(let i=0; i<totalCells; i++){
        const dayNum = i - offset + 1;
        const inMonth = dayNum >= 1 && dayNum <= lastDay.getDate();
        const dateStr = inMonth ? `${monthStr}-${String(dayNum).padStart(2,"0")}` : "";
        const isToday = dateStr === todayStr;
        const isFrom = dateStr === pickerFrom;
        const isTo = dateStr === pickerTo;
        const inRange = dateStr && pickerFrom && pickerTo && dateStr > pickerFrom && dateStr < pickerTo;
        const cls = [
          "dp-cell",
          !inMonth?"dp-cell-off":"",
          isToday?"dp-cell-today":"",
          isFrom||isTo?"dp-cell-selected":"",
          isFrom?"dp-cell-from":"",
          isTo?"dp-cell-to":"",
          inRange?"dp-cell-range":"",
        ].filter(Boolean).join(" ");
        cells += `<div class="${cls}" ${dateStr?`data-date="${dateStr}"`:""}>${inMonth?dayNum:""}</div>`;
      }

      return `
        <div class="dp-cal">
          <div class="dp-cal-header">
            <span class="dp-month-label">${monthName}</span>
          </div>
          <div class="dp-weekdays"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>
          <div class="dp-grid">${cells}</div>
        </div>`;
    };

    const rangeLabel = pickerFrom && pickerTo
      ? `<span class="dp-range-label">${pickerFrom} → ${pickerTo}</span>`
      : pickerFrom
        ? `<span class="dp-range-label">${pickerFrom} → ...</span>`
        : `<span class="dp-range-label" style="color:var(--muted);">Select start date</span>`;

    container.innerHTML = `
      <div class="dp-nav">
        <button class="dp-nav-btn" id="dpPrev">‹</button>
        ${rangeLabel}
        <button class="dp-nav-btn" id="dpNext">›</button>
      </div>
      <div class="dp-cals">
        ${buildCal(y1,m1)}
        ${buildCal(y2,m2)}
      </div>
      <div class="dp-presets">
        <button class="dp-preset" data-preset="yesterday">Yesterday</button>
        <button class="dp-preset" data-preset="today">Today</button>
        <button class="dp-preset" data-preset="tomorrow">Tomorrow</button>
        <button class="dp-preset" data-preset="week">Next 7 days</button>
        <button class="dp-preset" data-preset="month">This month</button>
        <button class="dp-preset" data-preset="all">All</button>
      </div>`;

    // nav
    byId("dpPrev").addEventListener("click",()=>{
      const [y,m]=pickerViewMonth.split("-").map(Number);
      pickerViewMonth = m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`;
      renderDatePicker();
    });
    byId("dpNext").addEventListener("click",()=>{
      const [y,m]=pickerViewMonth.split("-").map(Number);
      pickerViewMonth = m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`;
      renderDatePicker();
    });

    // cell clicks
    container.querySelectorAll("[data-date]").forEach((cell)=>{
      cell.addEventListener("click",()=>{
        const d=cell.dataset.date;
        if(!pickerFrom||pickerTo||(d<pickerFrom)){pickerFrom=d;pickerTo="";}
        else if(d===pickerFrom){pickerFrom="";pickerTo="";}
        else{pickerTo=d;}
        renderDatePicker();
      });
    });

    // presets
    container.querySelectorAll("[data-preset]").forEach((btn)=>{
      btn.addEventListener("click",()=>{
        const today=new Date().toISOString().slice(0,10);
        const p=btn.dataset.preset;
        if(p==="today"){pickerFrom=today;pickerTo=today;}
        else if(p==="yesterday"){const d=new Date();d.setDate(d.getDate()-1);const iso=d.toISOString().slice(0,10);pickerFrom=iso;pickerTo=iso;}
        else if(p==="tomorrow"){const d=new Date();d.setDate(d.getDate()+1);const iso=d.toISOString().slice(0,10);pickerFrom=iso;pickerTo=iso;}
        else if(p==="week"){const d=new Date();d.setDate(d.getDate()+6);pickerFrom=today;pickerTo=d.toISOString().slice(0,10);}
        else if(p==="month"){const d=new Date();const last=new Date(d.getFullYear(),d.getMonth()+1,0);pickerFrom=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;pickerTo=last.toISOString().slice(0,10);}
        else if(p==="all"){pickerFrom="";pickerTo="";}
        renderDatePicker();
      });
    });
  };

  // ── CHECKBOX DROPDOWN BUILDER ─────────────────────────────────────────
  const buildCbDropdown = (id, options, selected, allLabel, onApply) => {
    // selected: null = all, [] = none, [...ids] = selected
    const allSelected = selected === null || selected.length === options.length;
    const selectedIds = selected === null ? options.map((o)=>o.value) : selected;
    const label = allSelected ? allLabel : selectedIds.length === 0 ? `No ${allLabel.toLowerCase()}` : selectedIds.length === 1 ? options.find((o)=>o.value===selectedIds[0])?.label||"1 selected" : `${selectedIds.length} selected`;

    return `
      <div class="cb-dropdown-wrap" id="cbWrap_${id}">
        <button type="button" class="cb-dropdown-trigger ${!allSelected?"has-selection":""}" id="cbTrigger_${id}">
          ${esc(label)} <span>▾</span>
        </button>
        <div class="cb-dropdown-panel" id="cbPanel_${id}">
          <input class="cb-search" placeholder="Search..." id="cbSearch_${id}" autocomplete="off">
          <div class="cb-options" id="cbOptions_${id}">
            <label class="cb-option cb-select-all">
              <input type="checkbox" id="cbAll_${id}" ${allSelected?"checked":""}>
              ${esc(allLabel)}
            </label>
            ${options.map((o)=>`
              <label class="cb-option" data-value="${esc(o.value)}">
                <input type="checkbox" value="${esc(o.value)}" ${selectedIds.includes(o.value)?"checked":""}>
                ${esc(o.label)}
              </label>`).join("")}
          </div>
          <div class="cb-footer">
            <span class="cb-count" id="cbCount_${id}">${allSelected?options.length:selectedIds.length} selected</span>
            <button type="button" class="cb-apply" id="cbApply_${id}">Apply</button>
          </div>
        </div>
      </div>`;
  };

  const bindCbDropdown = (id, options, onApply) => {
    const trigger = byId(`cbTrigger_${id}`);
    const panel = byId(`cbPanel_${id}`);
    const search = byId(`cbSearch_${id}`);
    const allCb = byId(`cbAll_${id}`);
    const countEl = byId(`cbCount_${id}`);
    const applyBtn = byId(`cbApply_${id}`);
    if (!trigger||!panel) return;

    trigger.addEventListener("click",(e)=>{ e.stopPropagation(); panel.classList.toggle("open"); if(panel.classList.contains("open")) search.focus(); });
    document.addEventListener("click",(e)=>{ if(!panel.contains(e.target)&&e.target!==trigger) panel.classList.remove("open"); });

    const updateCount = () => {
      const checked = Array.from(panel.querySelectorAll(".cb-option:not(.cb-select-all) input:checked"));
      countEl.textContent = `${checked.length} selected`;
    };

    search.addEventListener("input",()=>{
      const q=search.value.toLowerCase();
      panel.querySelectorAll(".cb-option:not(.cb-select-all)").forEach((opt)=>{
        opt.style.display=opt.textContent.toLowerCase().includes(q)?"":"none";
      });
    });

    allCb.addEventListener("change",()=>{
      panel.querySelectorAll(".cb-option:not(.cb-select-all) input").forEach((cb)=>cb.checked=allCb.checked);
      updateCount();
    });

    panel.querySelectorAll(".cb-option:not(.cb-select-all) input").forEach((cb)=>{
      cb.addEventListener("change",()=>{
        const all=panel.querySelectorAll(".cb-option:not(.cb-select-all) input");
        allCb.checked=[...all].every((x)=>x.checked);
        updateCount();
      });
    });

    applyBtn.addEventListener("click",()=>{
      const checked=Array.from(panel.querySelectorAll(".cb-option:not(.cb-select-all) input:checked")).map((cb)=>cb.value);
      panel.classList.remove("open");
      onApply(checked.length===options.length ? null : checked);
    });
  };

  // ── TASK FILTERS ─────────────────────────────────────────────────────
  const renderTaskFilters = () => {
    const wrap = byId("taskFiltersWrap"); if(!wrap) return;
    const drivers = store.getDrivers(state);
    const statuses = ["Open","In Progress","Completed"];
    const dateLabel = taskDateFrom && taskDateTo
      ? `${store.formatDate(taskDateFrom)} – ${store.formatDate(taskDateTo)}`
      : taskDateFrom ? store.formatDate(taskDateFrom) : "All dates";

    const driverOpts = drivers.map((d)=>({value:d.id,label:`${d.firstName} ${d.lastName}`}));
    const statusOpts = statuses.map((s)=>({value:s,label:s}));

    wrap.innerHTML = `
      <div class="task-filter-row">
        <button class="filter-btn ${taskDateFrom?"filter-btn-active":""}" id="openTaskDatePicker">📅 ${esc(dateLabel)}</button>
        ${buildCbDropdown("taskDrivers", driverOpts, taskSelectedDrivers, "All drivers", ()=>{})}
        ${buildCbDropdown("taskStatuses", statusOpts, taskSelectedStatuses, "All statuses", ()=>{})}
        ${taskDateFrom?`<button class="filter-clear-btn" id="clearTaskDate">✕ Clear dates</button>`:""}
      </div>`;

    byId("openTaskDatePicker").addEventListener("click",()=>{
      openDatePicker(taskDateFrom, taskDateTo, (from,to)=>{ taskDateFrom=from; taskDateTo=to; renderTaskFilters(); renderTasks(); });
    });
    const ccb=byId("clearTaskDate"); if(ccb) ccb.addEventListener("click",()=>{ taskDateFrom=""; taskDateTo=""; renderTaskFilters(); renderTasks(); });

    bindCbDropdown("taskDrivers", driverOpts, (sel)=>{ taskSelectedDrivers=sel; renderTaskFilters(); renderTasks(); });
    bindCbDropdown("taskStatuses", statusOpts, (sel)=>{ taskSelectedStatuses=sel; renderTaskFilters(); renderTasks(); });
  };
  const updateAddressContext = () => {
    const v=byId("taskType").value;
    const label=v==="Delivery"?"Ship To":v==="Collection"?"Ship From":"Address";
    byId("addressLegend").textContent=label;
    byId("addressHelper").textContent=`${label}: type to search or add a new company.`;
  };

  const resetTaskForm = () => {
    byId("taskForm").reset(); clearInvalid(byId("taskForm"));
    byId("taskId").value=""; selectedTaskId="";
    byId("taskFormHeading").textContent="Create task"; byId("taskFormError").textContent="";
    byId("deleteTaskButton").hidden=true; byId("taskType").value="";
    byId("awb").value=store.makeAwb(state);
    byId("orderDate").value=todayIso();
    byId("companyId").value=""; if(byId("companySearch")) byId("companySearch").value=""; closeDropdown();
    updateEditCompanyBtn(); hydrateTaskFormDriverSelect();
    byId("taskDriverId").value=""; // always clear driver on new task
    updateAddressContext();
    openModal(byId("taskDialog")); byId("deliveryDate").focus();
  };

  const taskDraftFromForm = () => {
    const c=state.companies.find((x)=>x.id===byId("companyId").value);
    return {
      id:byId("taskId").value||"", awb:byId("awb").value.trim(), orderReference:byId("orderReference").value.trim(),
      orderDate:byId("orderDate").value, deliveryDate:byId("deliveryDate").value,
      driverId:byId("taskDriverId").value, type:byId("taskType").value,
      deliveryTimeFrom:byId("deliveryTimeFrom").value, deliveryTimeTo:byId("deliveryTimeTo").value,
      qty:parseInt(byId("qty").value,10)||0, driverNotes:byId("driverNotes").value.trim(),
      companyId:byId("companyId").value, companyName:c?c.name:byId("companySearch").value.trim(),
      companyAddress:byId("companyAddress").value.trim(), city:byId("city").value.trim(), postcode:byId("postcode").value.trim(),
    };
  };

  const validateTask = (t) => {
    const m=[];
    if(!t.orderDate) m.push("orderDate"); if(!t.deliveryDate) m.push("deliveryDate");
    if(!t.type) m.push("taskType"); if(!t.companyId) m.push("companySearch");
    if(!t.city) m.push("city"); if(!t.postcode) m.push("postcode");
    if(!t.qty||t.qty<1) m.push("qty");
    if(m.length) return {message:"Please complete all required fields.",ids:m};
    return null;
  };

  const saveTask = (e) => {
    e.preventDefault(); clearInvalid(byId("taskForm"));
    const d=taskDraftFromForm();
    const err=validateTask(d); if(err){byId("taskFormError").textContent=err.message;markInvalid(err.ids);return;}
    const saved=store.upsertTask(state,d,currentAdminId());
    selectedTaskId=saved.id; persist(); closeModal(byId("taskDialog")); renderAll();
  };

  const timeRange = (t) => {
    if(t.deliveryTimeFrom&&t.deliveryTimeTo) return `${t.deliveryTimeFrom}–${t.deliveryTimeTo}`;
    if(t.deliveryTimeFrom) return t.deliveryTimeFrom;
    return "Any time";
  };

  const renderTasks = () => {
    const s = sortState.tasks;
    let tasks = state.tasks.filter((t) => {
      const allDriverIds = store.getDrivers(state).map((d)=>d.id);
      const activeDrivers = taskSelectedDrivers === null ? allDriverIds : taskSelectedDrivers;
      const activeStatuses = taskSelectedStatuses === null ? ["Open","In Progress","Completed"] : taskSelectedStatuses;
      const mDriver = activeDrivers.includes(t.driverId) || (!t.driverId && activeDrivers.length === allDriverIds.length);
      const mStatus = activeStatuses.includes(t.status);
      const mDate = (!taskDateFrom && !taskDateTo) ||
        (taskDateFrom && taskDateTo ? t.deliveryDate >= taskDateFrom && t.deliveryDate <= taskDateTo :
         taskDateFrom ? t.deliveryDate === taskDateFrom : true);
      return mDriver && mStatus && mDate;
    });
    tasks = sortArr(tasks, s.col, s.dir);
    byId("tasksSummary").textContent = `${pluralize(tasks.length,"task")} shown`;

    byId("tasksTable").innerHTML = `
      <thead><tr>
        <th class="sortable" data-table="tasks" data-col="awb">AWB ${sortIcon("tasks","awb")}</th>
        <th class="sortable" data-table="tasks" data-col="type">Type ${sortIcon("tasks","type")}</th>
        <th class="sortable" data-table="tasks" data-col="companyName">Company ${sortIcon("tasks","companyName")}</th>
        <th class="sortable" data-table="tasks" data-col="deliveryDate">Date / Time ${sortIcon("tasks","deliveryDate")}</th>
        <th class="sortable" data-table="tasks" data-col="qty">Qty ${sortIcon("tasks","qty")}</th>
        <th>Driver</th>
        <th class="sortable" data-table="tasks" data-col="status">Status ${sortIcon("tasks","status")}</th>
        <th class="right">Actions</th>
      </tr></thead>
      <tbody>${tasks.map((t) => {
        const unassigned = !t.driverId;
        return `<tr class="${t.id===selectedTaskId?"selected-row":""}">
          <td style="font-weight:800;">${esc(t.awb)}</td>
          <td><span class="type-chip type-${t.type.toLowerCase()}">${esc(t.type)}</span></td>
          <td class="address-column">${esc(t.companyName)}<small>${esc(store.addressLine(t))}</small></td>
          <td>${esc(store.formatDate(t.deliveryDate))}<small>${esc(timeRange(t))}</small></td>
          <td style="font-weight:800;">${esc(String(t.qty||"—"))}</td>
          <td>
            <select class="inline-select ${unassigned?"unassigned-select":""}" data-assign-task="${esc(t.id)}">
              ${driverSelectHtml(t.driverId||"","Unassigned")}
            </select>
          </td>
          <td>
            <select class="status-select status-${t.status.toLowerCase().replace(/ /g,"")}" data-change-status="${esc(t.id)}">
              <option value="Open" ${t.status==="Open"?"selected":""}>Open</option>
              <option value="In Progress" ${t.status==="In Progress"?"selected":""}>In Progress</option>
              <option value="Completed" ${t.status==="Completed"?"selected":""}>Completed</option>
            </select>
          </td>
          <td class="right action-cell">
            <button class="table-action" type="button" data-view-task="${esc(t.id)}">View</button>
            <button class="table-action" type="button" data-edit-task="${esc(t.id)}">Edit</button>
            <button class="table-action danger" type="button" data-delete-task="${esc(t.id)}">Delete</button>
          </td>
        </tr>`;
      }).join("")||`<tr><td colspan="8" class="empty-table">No tasks match the current filters.</td></tr>`}
      </tbody>`;
    bindSortHeaders(byId("tasksTable"), "tasks", renderTasks);
  };

  const populateTaskForm = (t) => {
    byId("taskId").value=t.id; byId("awb").value=t.awb; byId("orderReference").value=t.orderReference||"";
    byId("orderDate").value=t.orderDate; byId("deliveryDate").value=t.deliveryDate;
    byId("taskDriverId").value=t.driverId||""; byId("taskType").value=t.type;
    byId("deliveryTimeFrom").value=t.deliveryTimeFrom||""; byId("deliveryTimeTo").value=t.deliveryTimeTo||"";
    byId("qty").value=t.qty||""; byId("driverNotes").value=t.driverNotes||"";
    byId("companyId").value=t.companyId;
    const c=state.companies.find((x)=>x.id===t.companyId);
    if(byId("companySearch")) byId("companySearch").value=c?c.name:t.companyName||"";
    byId("companyAddress").value=t.companyAddress||""; byId("city").value=t.city||""; byId("postcode").value=t.postcode||"";
    updateAddressContext(); byId("taskFormHeading").textContent="Edit task"; byId("deleteTaskButton").hidden=false;
    updateEditCompanyBtn();
  };

  const editTask = (id) => {
    const t=state.tasks.find((x)=>x.id===id); if(!t) return;
    selectedTaskId=id; clearInvalid(byId("taskForm")); hydrateTaskFormDriverSelect(); populateTaskForm(t);
    byId("taskFormError").textContent=""; openModal(byId("taskDialog")); renderTasks();
  };

  const deleteTask = (id=byId("taskId").value) => {
    const t=state.tasks.find((x)=>x.id===id); if(!t) return;
    if(!confirm(`Delete task ${t.awb}?`)) return;
    state.tasks=state.tasks.filter((x)=>x.id!==id);
    if(selectedTaskId===id) selectedTaskId="";
    persist(); closeModal(byId("taskDialog")); closeModal(byId("taskViewDialog")); renderAll();
  };

  const assignTask = (id, driverId) => {
    const t=state.tasks.find((x)=>x.id===id); if(!t||t.driverId===driverId) return;
    store.upsertTask(state,{id,driverId},currentAdminId());
    persist(); renderAll(); if(activeSection==="calendar") renderCalendar();
  };

  const detailRow = (label,value) => `<div class="detail-row"><span>${esc(label)}</span><strong>${esc(value||"Not set")}</strong></div>`;

  const viewTask = (id) => {
    const t=state.tasks.find((x)=>x.id===id); if(!t) return;
    selectedTaskId=id; byId("taskViewTitle").textContent=t.awb;
    byId("taskDetailContent").innerHTML=`
      <section class="detail-card hero-detail-card">
        <div><p class="eyebrow">${esc(t.type)}</p><h3 style="font-size:1.1rem;font-weight:800">${esc(t.companyName)}</h3><p>${esc(store.addressLine(t))}</p></div>
        <span class="status-chip status-${t.status.toLowerCase().replace(/ /g,"")}">${esc(t.status)}</span>
      </section>
      <section class="detail-card">
        ${detailRow("AWB",t.awb)}${detailRow("Order ref",t.orderReference||"—")}
        ${detailRow("Driver",t.driverId?store.getUserName(state,t.driverId):"Unassigned")}
        ${detailRow("Qty (pallets)",String(t.qty||"—"))}
      </section>
      <section class="detail-card">
        ${detailRow("Delivery date",store.formatDate(t.deliveryDate))}
        ${detailRow("Delivery window",timeRange(t))}
        ${detailRow("Notes",t.driverNotes||"None")}
      </section>
      ${t.proof?`<section class="detail-card proof-detail-card"><h3>Proof</h3>${detailRow("Name",t.proof.recipientName)}${detailRow("Company",t.proof.companyName)}${detailRow("Submitted",store.formatDateTime(t.proof.completedAt))}${t.proof.attachmentName?detailRow("Attachment",t.proof.attachmentName):""}</section>`:""}`;
    renderTimeline(t); openModal(byId("taskViewDialog")); renderTasks();
  };

  const renderTimeline = (t) => {
    if(!(t.history||[]).length){byId("taskTimeline").innerHTML=`<p class="empty-state">No timeline events yet.</p>`;return;}
    byId("taskTimeline").innerHTML=(t.history||[]).map((e)=>`
      <article class="timeline-item"><span class="timeline-dot"></span>
        <div class="timeline-copy">
          <div class="timeline-heading"><strong>${esc(e.action)}</strong><time>${esc(store.formatDateTime(e.at))}</time></div>
          <p>${esc(e.actorName)}</p>
          <ul>${(e.changes||[]).map((c)=>`<li>${esc(c)}</li>`).join("")}</ul>
        </div>
      </article>`).join("");
  };

  // ── EXCEL EXPORT ──────────────────────────────────────────────────────
  const exportTasksToExcel = () => {
    let tasks = state.tasks.filter((t) => {
      const mDriver = !taskDriverFilter || t.driverId === taskDriverFilter;
      const mStatus = taskStatusFilter === "All" || t.status === taskStatusFilter;
      const mDate = (!taskDateFrom && !taskDateTo) ||
        (taskDateFrom && taskDateTo ? t.deliveryDate >= taskDateFrom && t.deliveryDate <= taskDateTo :
         taskDateFrom ? t.deliveryDate === taskDateFrom : true);
      return mDriver && mStatus && mDate;
    });
    const headers=["AWB","Order Ref","Type","Company","Address","City","Postcode","Delivery Date","Time Window","Qty","Driver","Status","Notes"];
    const rows=tasks.map((t)=>[t.awb,t.orderReference||"",t.type,t.companyName,t.companyAddress||"",t.city||"",t.postcode||"",store.formatDate(t.deliveryDate),timeRange(t),t.qty||0,t.driverId?store.getUserName(state,t.driverId):"Unassigned",t.status,t.driverNotes||""]);
    const csv=[headers,...rows].map((r)=>r.map((c)=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`tasks-${todayIso()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── SORT HEADER BINDING ───────────────────────────────────────────────
  const bindSortHeaders = (table, tableName, renderFn) => {
    if(!table) return;
    table.querySelectorAll("th.sortable").forEach((th)=>{
      th.style.cursor="pointer";
      th.addEventListener("click",()=>{ toggleSort(tableName, th.dataset.col); renderFn(); });
    });
  };

  // ── CALENDAR ──────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const todayStr = new Date().toISOString().slice(0,10);
    const from = calRangeFrom || (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; })();
    const to = calRangeTo || (() => { const d=new Date(); const last=new Date(d.getFullYear(),d.getMonth()+1,0); return last.toISOString().slice(0,10); })();
    const allDrivers = store.getDrivers(state);
    const selectedDrivers = calSelectedDrivers ? allDrivers.filter((d)=>calSelectedDrivers.includes(d.id)) : allDrivers;
    // Only show drivers who have at least one task in the date range
    const drivers = selectedDrivers.filter((d)=>
      state.tasks.some((t)=>t.driverId===d.id && t.deliveryDate>=from && t.deliveryDate<=to)
    );

    const dateLabel = calRangeFrom && calRangeTo
      ? `${store.formatDate(calRangeFrom)} – ${store.formatDate(calRangeTo)}`
      : "This month";

    const driverOpts2 = allDrivers.map((d)=>({value:d.id,label:`${d.firstName} ${d.lastName}`}));
    const driverDropHtml = buildCbDropdown("calDrivers", driverOpts2, calSelectedDrivers, "All drivers", ()=>{});

    const toolbarHtml = `
      <div class="cal-toolbar">
        <div>
          <div style="font-size:0.78rem;font-weight:900;text-transform:uppercase;color:var(--muted);margin-bottom:0.4rem;">Date range</div>
          <button class="filter-btn ${calRangeFrom?"filter-btn-active":""}" id="openCalDatePicker">📅 ${esc(dateLabel)}</button>
          ${calRangeFrom?`<button class="filter-clear-btn" id="clearCalDate" style="margin-left:0.5rem;">✕ Clear</button>`:""}
        </div>
        <div>
          <div style="font-size:0.78rem;font-weight:900;text-transform:uppercase;color:var(--muted);margin-bottom:0.4rem;">Drivers</div>
          ${driverDropHtml}
        </div>
      </div>`;

    if(drivers.length===0){
      byId("calendarContainer").innerHTML=toolbarHtml+`<p class="empty-state" style="padding:2rem;">No drivers to show.</p>`;
      bindCalToolbar(); return;
    }

    const getDates = (f, t) => {
      const dates=[]; const cur=new Date(f); const end=new Date(t);
      while(cur<=end){dates.push(cur.toISOString().slice(0,10));cur.setDate(cur.getDate()+1);}
      return dates;
    };
    const dates = getDates(from, to);

    const headerHtml=`
      <div class="day-cal-header">
        <div class="day-label-placeholder"></div>
        <div class="driver-cols" style="--driver-count:${drivers.length}">
          ${drivers.map((d)=>`<div class="driver-col-header"><span class="avatar" style="width:30px;height:30px;font-size:0.72rem;">${esc(d.firstName[0]||"")}${esc(d.lastName[0]||"")}</span><span>${esc(d.firstName)} ${esc(d.lastName)}</span></div>`).join("")}
        </div>
      </div>`;

    const dows=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    const dayRows=dates.map((date)=>{
      const dow=dows[new Date(date).getDay()];
      const dayNum=parseInt(date.split("-")[2],10);
      const isToday=date===todayStr;

      const cols=drivers.map((dr)=>{
        const deliveries=state.tasks.filter((t)=>t.deliveryDate===date&&t.driverId===dr.id&&t.type==="Delivery");
        const collections=state.tasks.filter((t)=>t.deliveryDate===date&&t.driverId===dr.id&&t.type==="Collection");
        const jobBtn=(t)=>{
          const sc=t.status.toLowerCase().replace(/ /g,"");
          return `<button class="cal-job status-${sc} ${t.type==="Collection"?"cal-job-collection":""}" type="button" data-view-task="${esc(t.id)}">
            <span class="cal-job-awb">${esc(t.awb)}</span>
            <span class="cal-job-company">${esc(t.companyName)}</span>
            <span class="cal-job-time">${esc(timeRange(t))}</span>
            <span class="cal-job-meta">${esc(t.qty||"?")} plt${t.driverNotes?" · "+esc(t.driverNotes.slice(0,30)):""}</span>
            <span class="status-chip status-${sc}" style="font-size:0.65rem;padding:0.1rem 0.38rem;margin-top:0.1rem;align-self:start;">${esc(t.status)}</span>
          </button>`;
        };
        const totalPlt=[...deliveries,...collections].reduce((s,t)=>s+(t.qty||0),0);
        const summaryHtml=(deliveries.length||collections.length)?`<div class="cal-day-summary">${deliveries.length} del · ${collections.length} col · ${totalPlt} plt</div>`:"";
        const deliveryHtml=deliveries.length?`<div class="cal-section-label cal-del-label">Deliveries</div>${deliveries.map(jobBtn).join("")}`:"";
        const collectionHtml=collections.length?`<div class="cal-section-label cal-col-label">Collections</div>${collections.map(jobBtn).join("")}`:"";
        const emptyHtml=(!deliveries.length&&!collections.length)?`<span class="cal-empty-slot">—</span>`:"";
        return `<div class="driver-col">${deliveryHtml}${collectionHtml}${emptyHtml}${summaryHtml}</div>`;
      }).join("");

      const hasAny=drivers.some((dr)=>state.tasks.some((t)=>t.deliveryDate===date&&t.driverId===dr.id));
      return `<div class="day-row ${isToday?"day-row-today":""} ${hasAny?"":"day-row-empty"}">
        <div class="day-label ${isToday?"day-label-today":""}"><span class="day-num">${dayNum}</span><span class="day-dow">${dow}</span></div>
        <div class="driver-cols" style="--driver-count:${drivers.length}">${cols}</div>
      </div>`;
    }).join("");

    byId("calendarContainer").innerHTML=toolbarHtml+`<div class="day-cal-wrap">${headerHtml}<div class="day-cal">${dayRows}</div></div>`;
    bindCalToolbar();
    byId("calendarContainer").addEventListener("click",(e)=>{ const v=e.target.closest("[data-view-task]"); if(v) viewTask(v.dataset.viewTask); });
  };

  const bindCalToolbar = () => {
    const openBtn=byId("openCalDatePicker");
    if(openBtn) openBtn.addEventListener("click",()=>{
      openDatePicker(calRangeFrom, calRangeTo, (from,to)=>{ calRangeFrom=from; calRangeTo=to; renderCalendar(); });
    });
    const clearBtn=byId("clearCalDate");
    if(clearBtn) clearBtn.addEventListener("click",()=>{ calRangeFrom=""; calRangeTo=""; renderCalendar(); });

    const driverOpts3 = store.getDrivers(state).map((d)=>({value:d.id,label:`${d.firstName} ${d.lastName}`}));
    bindCbDropdown("calDrivers", driverOpts3, (sel)=>{ calSelectedDrivers=sel; renderCalendar(); });
  };

  // ── RENDER ALL ────────────────────────────────────────────────────────
  const renderAll = () => {
    state=store.loadState(); renderIdentity();
    renderUsers(); renderCompanies(); renderTaskFilters(); renderTasks();
    if(activeSection==="calendar") renderCalendar();
  };

  // ── BIND EVENTS ───────────────────────────────────────────────────────
  const bindEvents = () => {
    qsa(".nav-item").forEach((i)=>i.addEventListener("click",()=>setSection(i.dataset.section)));
    qsa("[data-close-modal]").forEach((b)=>b.addEventListener("click",()=>closeModal(b.closest("dialog"))));

    byId("resetUserForm").addEventListener("click",resetUserForm);
    byId("cancelUserEdit").addEventListener("click",()=>closeModal(byId("userDialog")));
    byId("userForm").addEventListener("submit",saveUser);
    byId("usersTable").addEventListener("click",(e)=>{
      const ed=e.target.closest("[data-edit-user]"); const rp=e.target.closest("[data-reset-pw]"); const dl=e.target.closest("[data-delete-user]");
      if(ed) editUser(ed.dataset.editUser);
      if(rp) openResetPwDialog(rp.dataset.resetPw);
      if(dl) deleteUser(dl.dataset.deleteUser);
    });

    byId("resetPwForm").addEventListener("submit",saveResetPw);
    byId("cancelResetPw").addEventListener("click",()=>closeModal(byId("resetPwDialog")));

    byId("resetCompanyForm").addEventListener("click",()=>openCompanyForm());
    byId("cancelCompanyEdit").addEventListener("click",()=>closeModal(byId("companyDialog")));
    byId("deleteCompanyButton").addEventListener("click",deleteCompany);
    byId("companyForm").addEventListener("submit",saveCompany);
    byId("companiesTable").addEventListener("click",(e)=>{
      const ed=e.target.closest("[data-edit-company]"); const dl=e.target.closest("[data-delete-company]");
      if(ed){const c=state.companies.find((x)=>x.id===ed.dataset.editCompany);openCompanyForm(c);}
      if(dl){
        const c=state.companies.find((x)=>x.id===dl.dataset.deleteCompany); if(!c) return;
        if(!confirm(state.tasks.some((t)=>t.companyId===c.id)?`"${c.name}" is used in tasks. Delete anyway?`:`Delete "${c.name}"?`)) return;
        state.companies=state.companies.filter((x)=>x.id!==c.id); persist(); renderAll();
      }
    });

    byId("resetTaskForm").addEventListener("click",resetTaskForm);
    byId("cancelTaskEdit").addEventListener("click",()=>closeModal(byId("taskDialog")));
    byId("taskForm").addEventListener("submit",saveTask);
    byId("deleteTaskButton").addEventListener("click",()=>deleteTask());
    byId("taskType").addEventListener("change",updateAddressContext);
    byId("tasksTable").addEventListener("click",(e)=>{
      const v=e.target.closest("[data-view-task]"); const ed=e.target.closest("[data-edit-task]"); const dl=e.target.closest("[data-delete-task]");
      if(v) viewTask(v.dataset.viewTask); if(ed) editTask(ed.dataset.editTask); if(dl) deleteTask(dl.dataset.deleteTask);
    });
    byId("tasksTable").addEventListener("change",(e)=>{ const a=e.target.closest("[data-assign-task]"); if(a) assignTask(a.dataset.assignTask,a.value); });

    // Date picker OK button
    byId("datePickerOk").addEventListener("click",()=>{
      if(pickerCallback) pickerCallback(pickerFrom, pickerTo);
      closeModal(byId("datePickerDialog"));
    });
    byId("datePickerCancel").addEventListener("click",()=>closeModal(byId("datePickerDialog")));

    // Export
    byId("exportTasksBtn").addEventListener("click",exportTasksToExcel);

    bindCompanySearch();
  };

  try {
    bindEvents();
    renderAll();
    const syncEl = byId("syncIndicator");
    if(syncEl) {
      syncEl.textContent = "⟳ Loading...";
      syncEl.style.cursor = "pointer";
      syncEl.title = "Click to refresh from Google Sheets";
      syncEl.addEventListener("click", () => {
        syncEl.textContent = "⟳ Refreshing...";
        syncEl.className = "sync-indicator syncing";
        store.loadFromSheets().then((cloudData) => {
          if(cloudData){ state = store.loadState(); renderAll(); }
        });
      });
    }
    store.loadFromSheets().then((cloudData) => {
      if(cloudData){ state = store.loadState(); renderAll(); }
    });
    window.addEventListener("wmspal:sync-status", (e) => {
      if(!syncEl) return;
      const { status } = e.detail;
      syncEl.className = `sync-indicator ${status}`;
      if(status === "syncing") syncEl.textContent = "⟳ Saving...";
      else if(status === "ok") syncEl.textContent = "✓ Synced · click to refresh";
      else if(status === "error") syncEl.textContent = "⚠ Sync error · click to retry";
    });
  } catch(e) { console.error("WMSPal init error:", e); }
})();
