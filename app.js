const API = "http://localhost:3000";
let currentUser = null;
let cache = {};

const $ = (id) => document.getElementById(id);
const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-PK");
const today = () => new Date().toISOString().slice(0, 10);
const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      c
      ],
  );
const statusClass = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
async function api(path, options = {}) {
  const response = await fetch(`${API}/${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
async function loadData() {
  const names = [
    "users",
    "zones",
    "hydrants",
    "tankers",
    "drivers",
    "rates",
    "bookings",
    "subsidyApplications",
    "disputes",
  ];
  const values = await Promise.all(names.map((n) => api(n)));
  names.forEach((n, i) => (cache[n] = values[i]));
}
function showView(name) {
  ["loginView", "registerView", "dashboardView"].forEach((v) =>
    $(v).classList.toggle("hidden", v !== name),
  );
}
function setSession(user) {
  currentUser = user;
  $("userBadge").textContent = `${user.name} · ${user.role}`;
  $("userBadge").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  showView("dashboardView");
  renderDashboard();
}
function logout() {
  currentUser = null;
  $("userBadge").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  showView("loginView");
}
function zoneName(id) {
  return cache.zones.find((z) => z.id === Number(id))?.name || "Unknown zone";
}
function hydrantName(id) {
  return (
    cache.hydrants.find((h) => h.id === Number(id))?.name || "Not assigned"
  );
}
function tankerName(id) {
  return (
    cache.tankers.find((t) => t.id === Number(id))?.number || "Not assigned"
  );
}
function driverName(id) {
  return cache.drivers.find((d) => d.id === Number(id))?.name || "Not assigned";
}
function stat(label, value, icon) {
  return `<div class="stat-card"><span class="stat-icon">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
}
function panel(title, body, extra = "") {
  return `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">No records found</td></tr>`}</tbody></table></div>`;
}
function badge(s) {
  return `<span class="status ${statusClass(s)}">${esc(s)}</span>`;
}
function renderDashboard() {
  $("todayDate").textContent = new Date().toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  $("roleLabel").textContent = currentUser.role.toUpperCase();
  const renderers = {
    Customer: renderCustomer,
    "Zone Officer": renderOfficer,
    "Hydrant Operator": renderOperator,
    Driver: renderDriver,
    Administrator: renderAdmin,
  };
  (renderers[currentUser.role] || renderCustomer)();
}
function setPage(title, subtitle, stats, html) {
  $("pageTitle").textContent = title;
  $("pageSubtitle").textContent = subtitle;
  $("stats").innerHTML = stats;
  $("dashboardContent").innerHTML = html;
}
function customerBookings() {
  return cache.bookings.filter((b) => b.customerId === currentUser.id);
}
function renderCustomer() {
  const mine = customerBookings();
  const rows = mine
    .map(
      (b) =>
        `<tr><td>#PL-${b.id}</td><td>${esc(b.date)}</td><td>${esc(b.type)}</td><td>${b.capacity.toLocaleString()} gal</td><td>${money(b.amount)}</td><td>${badge(b.status)}</td><td>${badge(b.tripStatus)}</td><td><div class="actions">${["Pending", "Awaiting Approval", "Approved"].includes(b.status) ? `<button class="btn btn-danger" onclick="cancelBooking(${b.id})">Cancel</button>` : ""}${b.tripStatus === "Delivered" ? `<button class="btn btn-success" onclick="confirmDelivery(${b.id})">Confirm</button><button class="btn btn-outline" onclick="disputeDelivery(${b.id})">Dispute</button>` : ""}</div></td></tr>`,
    )
    .join("");
  const form = `<form id="bookingForm"><div class="form-row"><div class="field"><label for="bookingType">Booking type</label><select id="bookingType" required><option value="Commercial">Commercial</option><option value="Subsidised">Subsidised</option></select></div><div class="field"><label for="bookingCapacity">Tanker size</label><select id="bookingCapacity" required><option value="1000">1,000 gallons</option><option value="3000">3,000 gallons</option><option value="6000">6,000 gallons</option></select></div></div><div class="form-row"><div class="field"><label for="bookingDate">Delivery date</label><input id="bookingDate" type="date" min="${today()}" required></div><div class="field"><label for="bookingAddress">Delivery address</label><input id="bookingAddress" value="${esc(currentUser.address || "")}" required minlength="5"></div></div><div class="field"><label for="bookingHydrant">Preferred hydrant</label><select id="bookingHydrant" required>${cache.hydrants
    .filter((h) => h.zoneId === currentUser.zoneId)
    .map((h) => `<option value="${h.id}">${esc(h.name)}</option>`)
    .join(
      "",
    )}</select></div><p class="subtle">Commercial: Rs. 2 per gallon · Subsidised: Rs. 0.50 per gallon (approval required).</p><button class="btn btn-primary" type="submit">Submit booking</button><p class="error" id="bookingError"></p></form>`;
  const subsidy = `<div class="notice">Subsidised bookings require verified eligibility. Submit your proof details for officer review.</div><form id="subsidyForm"><div class="field"><label for="proof">Proof document details</label><input id="proof" required minlength="5" placeholder="e.g. Low income certificate / hospital registration"></div><button class="btn btn-soft" type="submit">Apply for subsidy status</button></form><p class="subtle">Current status: <b>${esc(currentUser.subsidyStatus || "Not Applied")}</b></p>`;
  setPage(
    "Customer Dashboard",
    "Book a tanker and follow your delivery.",
    stat("My bookings", mine.length, "📋") +
    stat(
      "Pending",
      mine.filter(
        (b) =>
          b.status.includes("Pending") || b.status === "Awaiting Approval",
      ).length,
      "⏳",
    ) +
    stat(
      "Delivered",
      mine.filter((b) => b.tripStatus === "Delivered").length,
      "✓",
    ) +
    stat("Subsidy status", currentUser.subsidyStatus || "Not Applied", "♧"),
    `<div class="content-grid">${panel("Book a water tanker", form)}${panel("Subsidy application", subsidy)}</div>${panel("My booking history", table(["Booking", "Date", "Type", "Quantity", "Bill", "Approval", "Delivery", "Actions"], rows))}`,
  );
  $("bookingForm").addEventListener("submit", createBooking);
  $("subsidyForm").addEventListener("submit", applySubsidy);
}
async function createBooking(e) {
  e.preventDefault();
  const type = $("bookingType").value,
    capacity = Number($("bookingCapacity").value),
    date = $("bookingDate").value,
    hydrantId = Number($("bookingHydrant").value),
    address = $("bookingAddress").value.trim();
  const err = $("bookingError");
  err.textContent = "";
  if (!date || date < today() || address.length < 5) {
    err.textContent = "Please enter a valid future date and address.";
    return;
  }
  if (type === "Subsidised" && currentUser.subsidyStatus !== "Approved") {
    err.textContent =
      "Your subsidy status must be approved before using a subsidised booking.";
    return;
  }
  const rate = cache.rates.find((r) => r.type === type)?.ratePerGallon || 0;
  try {
    const b = await api("bookings", {
      method: "POST",
      body: JSON.stringify({
        customerId: currentUser.id,
        customerName: currentUser.name,
        zoneId: currentUser.zoneId,
        hydrantId,
        type,
        capacity,
        address,
        date,
        status: type === "Subsidised" ? "Awaiting Approval" : "Approved",
        amount: capacity * rate,
        tankerId: null,
        driverId: null,
        tripStatus: "Pending",
        createdAt: today(),
      }),
    });
    cache.bookings.push(b);
    renderDashboard();
    alert("Booking submitted successfully.");
  } catch (x) {
    err.textContent = x.message;
  }
}

async function applySubsidy(e) {
  e.preventDefault();

  const proof = $("proof").value.trim();

  if (proof.length < 5) {
    alert("Please enter valid proof details.");
    return;
  }

  try {
    // Save the new application with customer and zone details
    const application = await api("subsidyApplications", {
      method: "POST",
      body: JSON.stringify({
        customerId: currentUser.id,
        customerName: currentUser.name,
        zoneId: Number(currentUser.zoneId),
        proof: proof,
        status: "Pending",
        date: today(),
      }),
    });

    // Update local application cache
    cache.subsidyApplications.push(application);

    // Update customer subsidy status
    await api(`users/${currentUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        subsidyStatus: "Pending",
      }),
    });

    currentUser.subsidyStatus = "Pending";

    const user = cache.users.find(
      (u) => Number(u.id) === Number(currentUser.id),
    );

    if (user) {
      user.subsidyStatus = "Pending";
    }

    renderDashboard();

    alert("Subsidy application submitted successfully!");
  } catch (error) {
    console.error(error);
    alert("Unable to submit subsidy application.");
  }
}

async function cancelBooking(id) {
  const b = cache.bookings.find((x) => x.id === id);
  if (!b || !confirm("Cancel this booking?")) return;
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Cancelled" }),
  });
  b.status = "Cancelled";
  renderDashboard();
}
async function confirmDelivery(id) {
  if (!confirm("Confirm that the delivery was received?")) return;
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ tripStatus: "Confirmed", status: "Confirmed" }),
  });
  renderDashboard();
}
async function disputeDelivery(id) {
  const reason = prompt("Please enter the reason for dispute:");
  if (!reason || reason.trim().length < 4)
    return alert("Please provide a reason.");
  await api("disputes", {
    method: "POST",
    body: JSON.stringify({
      bookingId: id,
      customerId: currentUser.id,
      reason,
      status: "Open",
      date: today(),
    }),
  });
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ tripStatus: "Disputed" }),
  });
  renderDashboard();
  alert("Dispute submitted to the Water Board.");
}

function renderOfficer() {
  const zoneBookings = cache.bookings.filter(
    (b) => Number(b.zoneId) === Number(currentUser.zoneId),
  );

  const apps = cache.subsidyApplications.filter((a) => {
    const customer = cache.users.find(
      (u) => Number(u.id) === Number(a.customerId),
    );

    const applicationZone = a.zoneId ?? customer?.zoneId;

    return Number(applicationZone) === Number(currentUser.zoneId);
  });

  const bookingRows = zoneBookings
    .map(
      (b) => `
    <tr>
      <td>#PL-${b.id}</td>
      <td>${esc(b.customerName)}</td>
      <td>${esc(b.type)}</td>
      <td>${b.capacity.toLocaleString()} gal</td>
      <td>${esc(b.date)}</td>
      <td>${badge(b.status)}</td>
      <td>
        ${b.status === "Awaiting Approval"
          ? `<button class="btn btn-success" onclick="approveBooking(${b.id})">Approve</button>
             <button class="btn btn-danger" onclick="rejectBooking(${b.id})">Reject</button>`
          : "View only"
        }
      </td>
    </tr>
  `,
    )
    .join("");

  const subsidyRows = apps
    .map(
      (a) => `
    <tr>
      <td>${esc(a.customerName)}</td>
      <td>${esc(a.proof)}</td>
      <td>${badge(a.status)}</td>
      <td>
        ${a.status === "Pending"
          ? `<button class="btn btn-success"
               onclick="reviewSubsidy(${a.id}, 'Approved')">Verify / Approve</button>
             <button class="btn btn-danger"
               onclick="reviewSubsidy(${a.id}, 'Rejected')">Reject</button>`
          : "Reviewed"
        }
      </td>
    </tr>
  `,
    )
    .join("");

  setPage(
    "Zone Officer Dashboard",
    `Manage applications and bookings in ${zoneName(currentUser.zoneId)}.`,
    stat("Zone bookings", zoneBookings.length, "📋") +
    stat(
      "Awaiting approval",
      zoneBookings.filter((b) => b.status === "Awaiting Approval").length,
      "⏳",
    ) +
    stat("Subsidy applications", apps.length, "♧") +
    stat(
      "Open disputes",
      cache.disputes.filter((d) => d.status === "Open").length,
      "⚑",
    ),

    `${panel(
      "Subsidy Applications",
      table(["Customer", "Proof Details", "Status", "Action"], subsidyRows),
    )}
    ${panel(
      "Bookings in My Zone",
      table(
        ["Booking", "Customer", "Type", "Quantity", "Date", "Status", "Action"],
        bookingRows,
      ),
    )}`,
  );
}

async function approveBooking(id) {
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Approved" }),
  });
  cache.bookings.find((b) => b.id === id).status = "Approved";
  renderDashboard();
}
async function rejectBooking(id) {
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Rejected" }),
  });
  cache.bookings.find((b) => b.id === id).status = "Rejected";
  renderDashboard();
}
async function reviewSubsidy(id, status) {
  const a = cache.subsidyApplications.find((x) => x.id === id);
  await api(`subsidyApplications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  a.status = status;
  const user = cache.users.find((u) => u.id === a.customerId);
  if (user) {
    await api(`users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ subsidyStatus: status }),
    });
    user.subsidyStatus = status;
  }
  renderDashboard();
}
function renderOperator() {
  const h =
    cache.hydrants.find((x) => x.id === currentUser.hydrantId) ||
    cache.hydrants[0],
    bookings = cache.bookings.filter(
      (b) => b.hydrantId === h.id && b.status === "Approved",
    );
  const rows = bookings
    .map(
      (b) =>
        `<tr><td>#PL-${b.id}</td><td>${esc(b.customerName)}</td><td>${b.capacity.toLocaleString()} gal</td><td>${esc(b.date)}</td><td>${esc(tankerName(b.tankerId))}</td><td>${esc(driverName(b.driverId))}</td><td>${badge(b.tripStatus)}</td><td><div class="actions">${!b.tankerId ? `<button class="btn btn-primary" onclick="assignResources(${b.id})">Assign</button>` : ""}${b.tankerId && b.tripStatus === "Pending" ? `<button class="btn btn-soft" onclick="updateTrip(${b.id},'Filled')">Mark filled</button>` : ""}${b.tripStatus === "Filled" ? `<button class="btn btn-success" onclick="updateTrip(${b.id},'Dispatched')">Tanker departed</button>` : ""}</div></td></tr>`,
    )
    .join("");
  const quota = Math.max(0, h.quota - h.used);
  const resources = `<div class="notice"><b>${esc(h.name)}</b> · Daily quota ${h.quota.toLocaleString()} gallons · Used ${h.used.toLocaleString()} gallons · Remaining ${quota.toLocaleString()} gallons<br>Operating hours: ${esc(h.hours)}</div><div class="progress"><span style="width:${Math.min(100, (h.used / h.quota) * 100)}%"></span></div><p class="subtle">${Math.round((h.used / h.quota) * 100)}% of daily quota used</p><div class="actions"><button class="btn btn-outline" onclick="toggleHydrant(${h.id})">${h.status === "Unavailable" ? "Mark available" : "Mark unavailable"}</button></div>`;
  const tankerRows = cache.tankers
    .filter((t) => t.hydrantId === h.id)
    .map(
      (t) =>
        `<tr><td>${esc(t.number)}</td><td>${t.capacity.toLocaleString()} gal</td><td>${badge(t.status)}</td><td><button class="btn btn-outline" onclick="toggleTanker(${t.id})">${t.status === "Available" ? "Set unavailable" : "Set available"}</button></td></tr>`,
    )
    .join("");
  setPage(
    "Hydrant Operator Dashboard",
    "Assign available tankers and drivers, and record dispatch.",
    stat("Approved bookings", bookings.length, "📋") +
    stat(
      "Available tankers",
      cache.tankers.filter(
        (t) => t.hydrantId === h.id && t.status === "Available",
      ).length,
      "🚚",
    ) +
    stat(
      "Available drivers",
      cache.drivers.filter((d) => d.status === "Available").length,
      "👷",
    ) +
    stat("Quota remaining", quota.toLocaleString(), "💧"),
    `${panel("Hydrant status", resources)}${panel("Approved bookings", table(["Booking", "Customer", "Quantity", "Date", "Tanker", "Driver", "Trip status", "Actions"], rows))}${panel("Tanker availability", table(["Tanker", "Capacity", "Status", "Action"], tankerRows))}`,
  );
}
async function assignResources(id) {
  const b = cache.bookings.find((x) => x.id === id);
  const t = cache.tankers.filter(
    (x) =>
      x.hydrantId === b.hydrantId &&
      x.status === "Available" &&
      x.capacity >= b.capacity,
  );
  const d = cache.drivers.filter((x) => x.status === "Available");
  if (!t.length || !d.length)
    return alert("No suitable available tanker or driver.");
  const tid = prompt(
    "Enter tanker ID:\n" +
    t.map((x) => `${x.id}: ${x.number} (${x.capacity} gal)`).join("\n"),
  );
  if (!tid || !t.some((x) => x.id === Number(tid)))
    return alert("Invalid tanker ID.");
  const did = prompt(
    "Enter driver ID:\n" + d.map((x) => `${x.id}: ${x.name}`).join("\n"),
  );
  if (!did || !d.some((x) => x.id === Number(did)))
    return alert("Invalid driver ID.");
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      tankerId: Number(tid),
      driverId: Number(did),
      tripStatus: "Pending",
    }),
  });
  await api(`tankers/${tid}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Assigned" }),
  });
  await api(`drivers/${did}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Assigned" }),
  });
  b.tankerId = Number(tid);
  b.driverId = Number(did);
  cache.tankers.find((x) => x.id === Number(tid)).status = "Assigned";
  cache.drivers.find((x) => x.id === Number(did)).status = "Assigned";
  renderDashboard();
}
async function updateTrip(id, status) {
  const b = cache.bookings.find((x) => x.id === id);
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ tripStatus: status }),
  });
  b.tripStatus = status;
  if (status === "Dispatched") {
    const h = cache.hydrants.find((x) => x.id === b.hydrantId);
    h.used += b.capacity;
    await api(`hydrants/${h.id}`, {
      method: "PATCH",
      body: JSON.stringify({ used: h.used }),
    });
  }
  renderDashboard();
}
async function toggleHydrant(id) {
  const h = cache.hydrants.find((x) => x.id === id),
    status = h.status === "Unavailable" ? "Available" : "Unavailable";
  await api(`hydrants/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  h.status = status;
  renderDashboard();
}
async function toggleTanker(id) {
  const t = cache.tankers.find((x) => x.id === id),
    status = t.status === "Available" ? "Unavailable" : "Available";
  await api(`tankers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  t.status = status;
  renderDashboard();
}
function renderDriver() {
  const trips = cache.bookings.filter(
    (b) =>
      b.driverId === currentUser.id ||
      (currentUser.id === 4 && b.driverId === 1),
  );
  const rows = trips
    .map(
      (b) =>
        `<tr><td>#PL-${b.id}</td><td>${esc(b.address)}</td><td>${esc(b.date)}</td><td>${b.capacity.toLocaleString()} gal</td><td>${esc(tankerName(b.tankerId))}</td><td>${badge(b.tripStatus)}</td><td><div class="actions">${b.tripStatus === "Dispatched" ? `<button class="btn btn-soft" onclick="driverUpdate(${b.id},'Arrived')">Arrived</button>` : ""}${b.tripStatus === "Arrived" ? `<button class="btn btn-success" onclick="driverUpdate(${b.id},'Delivered')">Delivered</button><button class="btn btn-danger" onclick="driverFail(${b.id})">Failed</button>` : ""}</div></td></tr>`,
    )
    .join("");
  setPage(
    "Driver Dashboard",
    "Your assigned trips only. Update the delivery status from your phone.",
    stat("Assigned trips", trips.length, "🚚") +
    stat(
      "To deliver",
      trips.filter((b) => ["Dispatched", "Arrived"].includes(b.tripStatus))
        .length,
      "📍",
    ) +
    stat(
      "Delivered",
      trips.filter((b) => b.tripStatus === "Delivered").length,
      "✓",
    ) +
    stat(
      "Failed",
      trips.filter((b) => b.tripStatus === "Failed").length,
      "!",
    ),
    panel(
      "My delivery trips",
      table(
        [
          "Trip",
          "Delivery address",
          "Date",
          "Quantity",
          "Tanker",
          "Status",
          "Update",
        ],
        rows,
      ),
    ),
  );
}
async function driverUpdate(id, status) {
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ tripStatus: status }),
  });
  renderDashboard();
}
async function driverFail(id) {
  const reason = prompt(
    "Enter failure reason (e.g. house locked, road blocked):",
  );
  if (!reason || reason.trim().length < 4)
    return alert("A failure reason is required.");
  await api(`bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      tripStatus: "Failed",
      failureReason: reason.trim(),
    }),
  });
  renderDashboard();
}
function renderAdmin() {
  const b = cache.bookings;
  const bookingRows = b
    .map(
      (x) =>
        `<tr><td>#PL-${x.id}</td><td>${esc(x.customerName)}</td><td>${esc(zoneName(x.zoneId))}</td><td>${esc(x.type)}</td><td>${x.capacity.toLocaleString()} gal</td><td>${badge(x.status)}</td><td>${badge(x.tripStatus)}</td></tr>`,
    )
    .join("");
  const hydrantRows = cache.hydrants
    .map(
      (h) =>
        `<tr><td>${esc(h.name)}</td><td>${esc(zoneName(h.zoneId))}</td><td>${h.quota.toLocaleString()}</td><td>${h.used.toLocaleString()}</td><td>${badge(h.status || "Available")}</td></tr>`,
    )
    .join("");
  const tankerRows = cache.tankers
    .map(
      (t) =>
        `<tr><td>${esc(t.number)}</td><td>${t.capacity.toLocaleString()} gal</td><td>${esc(hydrantName(t.hydrantId))}</td><td>${badge(t.status)}</td></tr>`,
    )
    .join("");
  const userRows = cache.users
    .map(
      (u) =>
        `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${esc(zoneName(u.zoneId))}</td></tr>`,
    )
    .join("");
  const rates = cache.rates
    .map(
      (r) =>
        `<tr><td>${esc(r.type)}</td><td>${money(r.ratePerGallon)} / gallon</td></tr>`,
    )
    .join("");
  setPage(
    "Administrator Dashboard",
    "City-wide overview and resource management.",
    stat("Total bookings", b.length, "📋") +
    stat(
      "Customers",
      cache.users.filter((u) => u.role === "Customer").length,
      "👥",
    ) +
    stat("Hydrants", cache.hydrants.length, "🏭") +
    stat("Tankers", cache.tankers.length, "🚚"),
    `${panel("All city bookings", table(["Booking", "Customer", "Zone", "Type", "Quantity", "Approval", "Delivery"], bookingRows))}<div class="content-grid">${panel("Hydrants and quotas", table(["Hydrant", "Zone", "Daily quota", "Used", "Status"], hydrantRows))}${panel("Tanker fleet", table(["Tanker", "Capacity", "Hydrant", "Status"], tankerRows))}</div><div class="content-grid">${panel("User accounts", table(["Name", "Email", "Role", "Zone"], userRows))}${panel("Booking rates", table(["Booking type", "Rate"], rates))}</div>${panel("Add a hydrant", `<form id="hydrantForm" class="form"><div class="field"><label for="newHydrantName">Hydrant name</label><input id="newHydrantName" required minlength="3"></div><div class="form-row"><div class="field"><label for="newHydrantZone">Zone</label><select id="newHydrantZone">${cache.zones.map((z) => `<option value="${z.id}">${esc(z.name)}</option>`).join("")}</select></div><div class="field"><label for="newHydrantQuota">Daily quota (gallons)</label><input id="newHydrantQuota" type="number" min="1000" required></div></div><div class="field"><label for="newHydrantHours">Operating hours</label><input id="newHydrantHours" required placeholder="08:00 AM - 08:00 PM"></div><button class="btn btn-primary" type="submit">Add hydrant</button></form>`)}`,
  );
  $("hydrantForm").addEventListener("submit", addHydrant);
}
async function addHydrant(e) {
  e.preventDefault();
  const name = $("newHydrantName").value.trim(),
    zoneId = Number($("newHydrantZone").value),
    quota = Number($("newHydrantQuota").value),
    hours = $("newHydrantHours").value.trim();
  if (name.length < 3 || quota < 1000 || !hours)
    return alert("Please enter valid hydrant details.");
  const h = await api("hydrants", {
    method: "POST",
    body: JSON.stringify({
      name,
      zoneId,
      quota,
      used: 0,
      hours,
      status: "Available",
    }),
  });
  cache.hydrants.push(h);
  renderDashboard();
  alert("Hydrant added.");
}
async function init() {
  $("showRegister").onclick = (e) => {
    e.preventDefault();
    showView("registerView");
  };
  $("showLogin").onclick = (e) => {
    e.preventDefault();
    showView("loginView");
  };
  $("logoutBtn").onclick = logout;
  $("brandHome").onclick = (e) => {
    e.preventDefault();
    if (currentUser) renderDashboard();
    else showView("loginView");
  };
  try {
    await loadData();
    $("regZone").innerHTML =
      '<option value="">Select zone</option>' +
      cache.zones
        .map((z) => `<option value="${z.id}">${esc(z.name)}</option>`)
        .join("");
  } catch (e) {
    $("loginError").textContent =
      "Mock API is not running. Start it with: npm run mock-api";
    return;
  }
  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("loginEmail").value.trim().toLowerCase(),
      password = $("loginPassword").value;
    const user = cache.users.find(
      (u) => u.email.toLowerCase() === email && u.password === password,
    );
    if (!user) {
      $("loginError").textContent = "Invalid email or password.";
      return;
    }
    $("loginError").textContent = "";
    setSession(user);
  });
  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("regName").value.trim(),
      email = $("regEmail").value.trim().toLowerCase(),
      password = $("regPassword").value,
      cnic = $("regCnic").value.trim(),
      phone = $("regPhone").value.trim(),
      address = $("regAddress").value.trim(),
      zoneId = Number($("regZone").value);
    const err = $("registerError");
    err.textContent = "";
    if (
      name.length < 3 ||
      password.length < 4 ||
      address.length < 5 ||
      !zoneId
    ) {
      err.textContent = "Please complete all fields correctly.";
      return;
    }
    if (
      cache.users.some(
        (u) => u.email.toLowerCase() === email || u.cnic === cnic,
      )
    ) {
      err.textContent = "Email or CNIC is already registered.";
      return;
    }
    try {
      const user = await api("users", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          cnic,
          phone,
          address,
          zoneId,
          role: "Customer",
          subsidyStatus: "Not Applied",
        }),
      });
      cache.users.push(user);
      setSession(user);
    } catch (x) {
      err.textContent = x.message;
    }
  });
}
document.addEventListener("DOMContentLoaded", init);
