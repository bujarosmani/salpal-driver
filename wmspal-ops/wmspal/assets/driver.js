(function () {
  const store = window.WMSPalStore;
  let state = store.loadState();
  let taskFilter = "Open";
  let driverTab = "today";
  let isDrawing = false;
  let hasSignature = false;
  let activeTaskId = "";
  let loggedInDriverId = "";

  const byId = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (v) => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const persist = () => store.saveState(state);
  const todayIso = () => new Date().toISOString().slice(0,10);

  const loginView = byId("loginView");
  const loginForm = byId("loginForm");
  const loginUsername = byId("loginUsername");
  const loginPassword = byId("loginPassword");
  const loginError = byId("loginError");
  const logoutBtn = byId("logoutBtn");
  const driverInitials = byId("driverInitials");
  const driverName = byId("driverName");
  const driverTaskCount = byId("driverTaskCount");
  const openTaskCount = byId("openTaskCount");
  const inprogressTaskCount = byId("inprogressTaskCount");
  const completedTaskCount = byId("completedTaskCount");
  const driverTaskList = byId("driverTaskList");
  const taskListView = byId("taskListView");
  const taskDetailView = byId("taskDetailView");
  const proofView = byId("proofView");
  const successView = byId("successView");
  const taskDetailPanel = byId("taskDetailPanel");
  const proofTitle = byId("proofTitle");
  const proofForm = byId("proofForm");
  const proofAttachment = byId("proofAttachment");
  const proofName = byId("proofName");
  const proofCompany = byId("proofCompany");
  const proofError = byId("proofError");
  const signatureCanvas = byId("signatureCanvas");
  const successText = byId("successText");
  const ctx = signatureCanvas.getContext("2d");

  const allViews = [loginView, taskListView, taskDetailView, proofView, successView];
  const showOnly = (view) => { allViews.forEach((v)=>v&&v.classList.toggle("active",v===view)); window.scrollTo({top:0,behavior:"auto"}); };

  // ── LOGIN ─────────────────────────────────────────────────────────────
  const showLogin = () => {
    showOnly(loginView);
    if (logoutBtn) logoutBtn.hidden = true;
    loginUsername.value = "";
    loginPassword.value = "";
    loginError.textContent = "";
    loginUsername.removeAttribute("aria-invalid");
    loginPassword.removeAttribute("aria-invalid");
    setTimeout(() => loginUsername.focus(), 50);
  };

  const doLogin = (e) => {
    e.preventDefault();
    state = store.loadState(); // always reload fresh from localStorage
    const u = loginUsername.value.trim().toLowerCase();
    const p = loginPassword.value;
    const driver = state.users.find((x) => x.role === "Driver" && x.username.toLowerCase() === u && x.password === p);
    if (!driver) { loginError.textContent = "Invalid username or password."; return; }
    loggedInDriverId = driver.id;
    state.selectedDriverId = driver.id;
    persist();
    if (logoutBtn) logoutBtn.hidden = false;
    taskFilter = "Open"; driverTab = "today";
    renderListView();
  };

  const doLogout = () => {
    loggedInDriverId = "";
    state.selectedDriverId = "";
    persist();
    taskFilter = "Open";
    driverTab = "today";
    showLogin();
  };

  // ── HELPERS ───────────────────────────────────────────────────────────
  const currentDriver = () => state.users.find((u)=>u.id===loggedInDriverId&&u.role==="Driver")||null;
  const driverId = () => loggedInDriverId;

  const timeRange = (t) => {
    if(t.deliveryTimeFrom&&t.deliveryTimeTo) return `${t.deliveryTimeFrom}–${t.deliveryTimeTo}`;
    if(t.deliveryTimeFrom) return t.deliveryTimeFrom;
    return "Any time";
  };

  const mapsUrl = (t) => {
    const addr=[t.companyName,t.companyAddress,t.city,t.postcode].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  };

  const allMapsUrl = (tasks) => {
    const pts=tasks.map((t)=>[t.companyName,t.companyAddress,t.city,t.postcode].filter(Boolean).join(", "));
    if(!pts.length) return "";
    if(pts.length===1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pts[0])}`;
    const dest=encodeURIComponent(pts[pts.length-1]);
    const wps=pts.slice(0,-1).map(encodeURIComponent).join("|");
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${wps}`;
  };

  const renderIdentity = () => {
    const d=currentDriver();
    driverInitials.textContent=d?`${d.firstName[0]||""}${d.lastName[0]||""}`:"--";
    driverName.textContent=d?`${d.firstName} ${d.lastName}`:"Not logged in";
  };

  const allDriverTasks = () =>
    state.tasks.filter((t)=>t.driverId===driverId())
      .sort((a,b)=>`${a.deliveryDate} ${a.deliveryTimeFrom||""}`.localeCompare(`${b.deliveryDate} ${b.deliveryTimeFrom||""}`));

  const todayTasks = () => allDriverTasks().filter((t)=>t.deliveryDate===todayIso());
  const upcomingTasks = () => allDriverTasks().filter((t)=>t.deliveryDate>todayIso());
  const getTask = (id) => state.tasks.find((t)=>t.id===id&&t.driverId===driverId());

  // ── TASK CARD ─────────────────────────────────────────────────────────
  const taskCardHtml = (t) => {
    const isDelivery = t.type==="Delivery";
    const actionLabel = isDelivery ? "Deliver to" : "Collect from";
    const statusClass = t.status.toLowerCase().replace(/ /g,"");
    return `
      <button class="driver-task-card ${t.type==="Delivery"?"card-delivery":"card-collection"}" type="button" data-task-id="${esc(t.id)}">
        <span class="task-card-top">
          <span class="type-chip type-${t.type.toLowerCase()}">${esc(t.type)}</span>
          <span class="status-chip status-${statusClass}">${esc(t.status)}</span>
        </span>
        <span class="task-card-main">
          <strong>${esc(t.awb)}</strong>
          <span>${esc(String(t.qty||"?"))} pallets</span>
        </span>
        <span class="task-card-address"><small>${esc(actionLabel)}</small>${esc(store.describeTaskAddress(t))}</span>
        <span class="task-card-meta">${esc(store.formatDate(t.deliveryDate))} · ${esc(timeRange(t))}</span>
        ${t.driverNotes?`<span class="task-card-note">${esc(t.driverNotes)}</span>`:""}
      </button>`;
  };

  // ── TASK LIST VIEW ────────────────────────────────────────────────────
  const renderListView = () => {
    state=store.loadState();
    renderIdentity();
    const todayList=todayTasks();
    // Metrics always show today's counts
    openTaskCount.textContent=String(todayList.filter((t)=>t.status==="Open").length);
    inprogressTaskCount.textContent=String(todayList.filter((t)=>t.status==="In Progress").length);
    completedTaskCount.textContent=String(todayList.filter((t)=>t.status==="Completed").length);

    qsa(".chip[data-mobile-filter]").forEach((b)=>b.classList.toggle("active",b.dataset.mobileFilter===taskFilter));
    qsa(".driver-tab-btn").forEach((b)=>b.classList.toggle("active",b.dataset.tab===driverTab));

    if(driverTab==="upcoming"){
      const upcoming=upcomingTasks();
      driverTaskCount.textContent=String(upcoming.length);
      if(!upcoming.length){driverTaskList.innerHTML=`<div class="empty-card"><strong>No upcoming tasks</strong><span>Future jobs assigned to you will appear here.</span></div>`;showOnly(taskListView);return;}
      const byDate={};
      upcoming.forEach((t)=>{if(!byDate[t.deliveryDate])byDate[t.deliveryDate]=[];byDate[t.deliveryDate].push(t);});
      driverTaskList.innerHTML=Object.keys(byDate).sort().map((date)=>
        `<div class="upcoming-date-group"><div class="upcoming-date-label">${esc(store.formatDate(date))}</div>${byDate[date].map(taskCardHtml).join("")}</div>`
      ).join("");
    } else {
      const filtered=taskFilter==="All"?todayList:todayList.filter((t)=>t.status===taskFilter);
      driverTaskCount.textContent=String(filtered.length);
      const openJobs=todayList.filter((t)=>t.status!=="Completed");
      const mapBtn=openJobs.length?`<a class="secondary-link" href="${allMapsUrl(openJobs)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:0.4rem;text-decoration:none;margin-bottom:0.4rem;">🗺 View today's route on map</a>`:"";
      driverTaskList.innerHTML=mapBtn+(filtered.map(taskCardHtml).join("")||`<div class="empty-card"><strong>No tasks for today</strong><span>Check Upcoming for future jobs.</span></div>`);
    }
    showOnly(taskListView);
  };

  // ── TASK DETAIL VIEW ──────────────────────────────────────────────────
  const renderTaskDetail = (id) => {
    state=store.loadState();
    const t=getTask(id); if(!t){renderListView();return;}
    activeTaskId=t.id;
    const isCompleted=t.status==="Completed";
    const isInProgress=t.status==="In Progress";
    const isOpen=t.status==="Open";
    const statusClass=t.status.toLowerCase().replace(/ /g,"");
    const actionLabel=t.type==="Delivery"?"Deliver to":"Collect from";

    taskDetailPanel.innerHTML=`
      <div class="detail-header">
        <div>
          <p class="eyebrow">${esc(t.type)}</p>
          <h1>${esc(t.awb)}</h1>
          <p class="muted">${esc(String(t.qty||"?"))} pallets</p>
        </div>
        <span class="status-chip status-${statusClass}">${esc(t.status)}</span>
      </div>
      <section class="mobile-detail-card ${t.type==="Delivery"?"card-delivery-detail":"card-collection-detail"}">
        <span>${esc(actionLabel)}</span>
        <strong>${esc(t.companyName)}</strong>
        <p>${esc(store.addressLine(t))}</p>
      </section>
      <a class="secondary-link" href="${mapsUrl(t)}" target="_blank" rel="noopener"
         style="display:flex;align-items:center;justify-content:center;gap:0.4rem;text-decoration:none;">
        📍 Open in Google Maps
      </a>
      <dl class="detail-list mobile-detail-list">
        <div><dt>Delivery date</dt><dd>${esc(store.formatDate(t.deliveryDate))}</dd></div>
        <div><dt>Time window</dt><dd>${esc(timeRange(t))}</dd></div>
        <div><dt>Notes</dt><dd>${esc(t.driverNotes||"No notes.")}</dd></div>
      </dl>
      ${isCompleted&&t.proof
        ? `<div class="proof-summary">
            <strong>Proof submitted</strong>
            <span>${esc(t.proof.recipientName)} · ${esc(store.formatDateTime(t.proof.completedAt))}</span>
            <span>${esc(t.proof.companyName)}</span>
            ${t.proof.attachmentName?`<span>${esc(t.proof.attachmentName)}</span>`:""}
          </div>`
        : isOpen
          ? `<button class="primary-button full-width large-tap" id="startTaskBtn">Start job</button>`
          : isInProgress
            ? `<button class="primary-button full-width large-tap" id="completeTaskBtn">Complete task</button>`
            : ""
      }`;

    const startBtn=byId("startTaskBtn");
    if(startBtn) startBtn.addEventListener("click",()=>{ store.startTask(state,t.id,driverId()); persist(); renderTaskDetail(t.id); });
    const completeBtn=byId("completeTaskBtn");
    if(completeBtn) completeBtn.addEventListener("click",()=>renderProofView(t.id));
    showOnly(taskDetailView);
  };

  // ── PROOF VIEW ────────────────────────────────────────────────────────
  const renderProofView = (id) => {
    const t=getTask(id); if(!t||t.status!=="In Progress"){renderTaskDetail(id);return;}
    activeTaskId=t.id; proofTitle.textContent=`Complete ${t.awb}`;
    proofForm.reset(); proofForm.querySelectorAll("[aria-invalid='true']").forEach((e)=>e.removeAttribute("aria-invalid"));
    clearSignature(); proofCompany.value=t.companyName; proofError.textContent="";
    showOnly(proofView); proofName.focus();
  };

  const renderSuccessView = (id) => {
    const t=getTask(id);
    successText.textContent=t?`${t.awb} is now completed and proof has been saved.`:"Task completed.";
    showOnly(successView);
  };

  // ── SIGNATURE ─────────────────────────────────────────────────────────
  const getCanvasPoint = (e) => {
    const rect=signatureCanvas.getBoundingClientRect();
    const p=e.touches?e.touches[0]:e;
    return {x:(p.clientX-rect.left)*(signatureCanvas.width/rect.width),y:(p.clientY-rect.top)*(signatureCanvas.height/rect.height)};
  };
  const clearSignature=()=>{ctx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);ctx.lineWidth=3;ctx.lineCap="round";ctx.strokeStyle="#132018";hasSignature=false;};
  const startDraw=(e)=>{e.preventDefault();isDrawing=true;hasSignature=true;const pt=getCanvasPoint(e);ctx.beginPath();ctx.moveTo(pt.x,pt.y);};
  const draw=(e)=>{if(!isDrawing)return;e.preventDefault();const pt=getCanvasPoint(e);ctx.lineTo(pt.x,pt.y);ctx.stroke();};
  const stopDraw=()=>{isDrawing=false;};

  const readAttachment=()=>new Promise((res,rej)=>{
    const file=proofAttachment.files[0];
    if(!file){res({attachmentName:"",attachmentType:"",attachmentDataUrl:""});return;}
    const r=new FileReader();
    r.onload=()=>res({attachmentName:file.name,attachmentType:file.type,attachmentDataUrl:r.result});
    r.onerror=()=>rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

  const submitProof=async(e)=>{
    e.preventDefault();
    proofForm.querySelectorAll("[aria-invalid='true']").forEach((x)=>x.removeAttribute("aria-invalid"));
    const t=getTask(activeTaskId); if(!t){renderListView();return;}
    const recipientName=proofName.value.trim(); const companyName=proofCompany.value.trim();
    const missing=[];
    if(!recipientName)missing.push("proofName"); if(!companyName)missing.push("proofCompany");
    if(missing.length){proofError.textContent="Please complete the required proof fields.";missing.forEach((id)=>{const e=byId(id);if(e)e.setAttribute("aria-invalid","true")});return;}
    if(!hasSignature){proofError.textContent="Signature is required.";return;}
    let attachment; try{attachment=await readAttachment();}catch{proofError.textContent="Attachment could not be read.";return;}
    store.completeTask(state,t.id,driverId(),{recipientName,companyName,...attachment,signatureDataUrl:signatureCanvas.toDataURL("image/png")});
    persist(); taskFilter="Completed"; renderSuccessView(t.id);
  };

  // ── EVENTS ────────────────────────────────────────────────────────────
  loginForm.addEventListener("submit",doLogin);
  if(logoutBtn) logoutBtn.addEventListener("click",doLogout);

  // Logo goes back to task list
  const logoLink=document.querySelector(".mobile-logo");
  if(logoLink) logoLink.addEventListener("click",(e)=>{
    if(loggedInDriverId){ e.preventDefault(); taskFilter="All"; driverTab="today"; renderListView(); }
  });

  driverTaskList.addEventListener("click",(e)=>{const c=e.target.closest("[data-task-id]");if(!c)return;renderTaskDetail(c.dataset.taskId);});
  qsa(".chip[data-mobile-filter]").forEach((b)=>b.addEventListener("click",()=>{taskFilter=b.dataset.mobileFilter;renderListView();}));
  qsa(".driver-tab-btn").forEach((b)=>b.addEventListener("click",()=>{ driverTab=b.dataset.tab; taskFilter="All"; renderListView(); }));
  byId("backToTasks").addEventListener("click",()=>renderListView());
  byId("backToDetail").addEventListener("click",()=>renderTaskDetail(activeTaskId));
  byId("returnToTasks").addEventListener("click",()=>renderListView());
  byId("clearSignature").addEventListener("click",clearSignature);
  proofForm.addEventListener("submit",submitProof);

  signatureCanvas.addEventListener("mousedown",startDraw);
  signatureCanvas.addEventListener("mousemove",draw);
  window.addEventListener("mouseup",stopDraw);
  signatureCanvas.addEventListener("touchstart",startDraw,{passive:false});
  signatureCanvas.addEventListener("touchmove",draw,{passive:false});
  window.addEventListener("touchend",stopDraw);

  clearSignature();
  // Load latest data from Google Sheets before showing login
  store.loadFromSheets().then((cloudData) => {
    if(cloudData) state = store.loadState();
    showLogin();
  }).catch(() => showLogin());
})();
