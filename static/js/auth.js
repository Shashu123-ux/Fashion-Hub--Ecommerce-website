function showToast(message, kind) {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;

  const toast = document.createElement("div");
  toast.className = "toast " + (kind || "");
  toast.innerHTML = `
    <div>
      <div class="msg">${escapeHtml(message)}</div>
      <div class="kind">${kind ? kind.toUpperCase() : "INFO"}</div>
    </div>
    <button class="btn" style="padding: 8px 10px; border-radius: 12px;" type="button">Close</button>
  `;

  const closeBtn = toast.querySelector("button");
  closeBtn.addEventListener("click", () => toast.remove());

  wrap.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4200);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function jsonFetch(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : "Request failed";
    throw new Error(msg);
  }
  return data;
}

function setupMobileMenu() {
  const btn = document.getElementById("hamburgerBtn");
  const menu = document.getElementById("mobileMenu");
  if (!btn || !menu) return;

  // Set initial aria attributes
  btn.setAttribute("aria-label", "Toggle navigation menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "mobileMenu");

  btn.addEventListener("click", () => {
    const isOpen = menu.classList.contains("active");
    if (isOpen) {
      menu.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
    } else {
      menu.classList.add("active");
      btn.setAttribute("aria-expanded", "true");
    }
  });

  // Close menu when a link is clicked
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
    });
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutBtnMobile = document.getElementById("logoutBtnMobile");
  const logoutBtnInline = document.getElementById("logoutBtnInline");

  async function doLogout() {
    try {
      await jsonFetch("/api/logout", { method: "POST", body: JSON.stringify({}) });
      showToast("Logged out", "ok");
      setTimeout(() => (window.location.href = "/"), 400);
    } catch (e) {
      showToast(e.message, "bad");
    }
  }

  window.doLogout = doLogout;
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
  if (logoutBtnMobile) logoutBtnMobile.addEventListener("click", doLogout);
  if (logoutBtnInline) logoutBtnInline.addEventListener("click", doLogout);
}

function setupLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      const data = await jsonFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      showToast("Login successful", "ok");
      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      }, 350);
    } catch (e2) {
      showToast(e2.message, "bad");
    }
  });
}

function setupRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const passInput = document.getElementById("regPassword");
  const confirmInput = document.getElementById("regConfirmPassword");
  const matchMsg = document.getElementById("passwordMatchMsg");

  function checkMatch() {
    if (!passInput || !confirmInput || !matchMsg) return true;
    const val1 = passInput.value;
    const val2 = confirmInput.value;
    
    // Only show error if confirm field has value and they don't match
    if (val2 && val1 !== val2) {
      matchMsg.style.display = "block";
      matchMsg.style.color = "#e53e3e"; // Red color
      return false;
    } else {
      matchMsg.style.display = "none";
      return true;
    }
  }

  if (passInput && confirmInput) {
    passInput.addEventListener("input", checkMatch);
    confirmInput.addEventListener("input", checkMatch);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!checkMatch()) {
      showToast("Passwords do not match.", "bad");
      return;
    }

    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!name || !email || !password) {
      showToast("Please fill in all fields.", "warn");
      return;
    }

    try {
      await jsonFetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      showToast("Registered successfully", "ok");
      setTimeout(() => (window.location.href = "/"), 350);
    } catch (e2) {
      showToast(e2.message, "bad");
    }
  });
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  
  // Update styling to indicate state (optional)
  btn.style.opacity = isPass ? "1" : "0.5";
}

async function loadProfile() {
  const summaryWrap = document.getElementById("profileSummaryWrap");
  const legacyWrap = document.getElementById("profileWrap");
  const wrap = summaryWrap || legacyWrap;
  if (!wrap) return;

  try {
    const me = await jsonFetch("/api/me");
    if (!me.logged_in) {
      window.location.href = "/login";
      return;
    }

    const u = me.user;
    if (summaryWrap) {
      summaryWrap.innerHTML = `
        <div><b>Name:</b> <span id="summaryName">${escapeHtml(u.name || "")}</span></div>
        <div><b>Email:</b> ${escapeHtml(u.email || "")}</div>
        <div><b>Account:</b> ${escapeHtml(u.role || "user")}</div>
      `;

      const editNameInput = document.getElementById("editNameInput");
      const emailReadonly = document.getElementById("emailReadonly");
      if (editNameInput) editNameInput.value = u.name || "";
      if (emailReadonly) emailReadonly.value = u.email || "";

      const wishlistBtn = document.getElementById("wishlistBtn");
      if (wishlistBtn) wishlistBtn.addEventListener("click", () => showToast("Wishlist is coming soon (UI only).", "warn"));

      setupEditNameForm();
      setupAddresses();
      setupPasswordChange();
      loadRecentOrderSnapshot();
      setupPreferences();
    } else {
      wrap.innerHTML = `
        <div><b>Name:</b> ${escapeHtml(u.name || "")}</div>
        <div><b>Email:</b> ${escapeHtml(u.email || "")}</div>
        <div><b>Role:</b> ${escapeHtml(u.role || "user")}</div>
        <div style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap">
          <a class="btn" href="/orders">View orders</a>
          <a class="btn primary" href="/products">Shop now</a>
        </div>
      `;
    }

    const txWrap = document.getElementById("transactionsWrap");
    if (txWrap) {
      const tx = await jsonFetch("/api/transactions");
      if (!tx.transactions.length) {
        txWrap.innerHTML = `<div class="empty-state">No transactions yet. Place an order to see payment records here.</div>`;
      } else {
        txWrap.innerHTML = `
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Order</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tx.transactions
                .map(
                  (t) => `
                <tr>
                  <td>${t.id}</td>
                  <td>#${t.order_id}</td>
                  <td>${escapeHtml(t.payment_mode)}</td>
                  <td>₹${formatMoney(t.amount)}</td>
                  <td>${escapeHtml(t.status)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `;
      }
    }
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
  }
}

function setupNewsletter() {
  const form = document.getElementById("newsletterForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailEl = document.getElementById("newsletterEmail");
    const email = emailEl ? emailEl.value.trim() : "";
    if (!email) {
      showToast("Please enter your email.", "warn");
      return;
    }
    showToast("Subscribed! (UI only)", "ok");
    form.reset();
  });
}

function setupEditNameForm() {
  const form = document.getElementById("editNameForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("editNameInput").value.trim();
    if (!name) {
      showToast("Name is required.", "warn");
      return;
    }
    try {
      await jsonFetch("/api/profile/name", { method: "POST", body: JSON.stringify({ name }) });
      const s = document.getElementById("summaryName");
      if (s) s.textContent = name;
      showToast("Profile updated successfully.", "ok");
    } catch (err) {
      showToast(err.message, "bad");
    }
  });
}

function clearAddressForm() {
  const id = document.getElementById("addressId");
  if (id) id.value = "";
  document.getElementById("addrFullName").value = "";
  document.getElementById("addrPhone").value = "";
  document.getElementById("addrStreet").value = "";
  document.getElementById("addrCity").value = "";
  document.getElementById("addrState").value = "";
  document.getElementById("addrPincode").value = "";
  document.getElementById("addrDefault").checked = false;
}

async function loadAddresses() {
  const list = document.getElementById("addressesList");
  const empty = document.getElementById("addressesEmpty");
  if (!list || !empty) return;

  const data = await jsonFetch("/api/addresses");
  const items = data.addresses || [];

  if (!items.length) {
    empty.style.display = "block";
    empty.textContent = "No saved addresses yet. Add one for a faster checkout.";
    list.innerHTML = "";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = items
    .map(
      (a) => `
      <div class="address-card" data-id="${a.id}">
        <div class="address-top">
          <div>
            <div class="address-name">${escapeHtml(a.full_name)} ${
        a.is_default ? '<span class="badge ok" style="margin-left:8px;">Default</span>' : ""
      }</div>
            <div class="address-line">${escapeHtml(a.phone)}</div>
          </div>
          <div class="address-actions">
            <button type="button" class="btn addrEditBtn" style="padding:10px 12px;">Edit</button>
            <button type="button" class="btn addrDeleteBtn" style="padding:10px 12px;">Delete</button>
          </div>
        </div>
        <div class="address-line">${escapeHtml(a.street)}, ${escapeHtml(a.city)}, ${escapeHtml(a.state)} - ${escapeHtml(a.pincode)}</div>
      </div>
    `
    )
    .join("");

  list.querySelectorAll(".addrEditBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".address-card");
      const id = Number(card.getAttribute("data-id"));
      const addr = items.find((x) => x.id === id);
      if (!addr) return;
      document.getElementById("addressId").value = String(addr.id);
      document.getElementById("addrFullName").value = addr.full_name || "";
      document.getElementById("addrPhone").value = addr.phone || "";
      document.getElementById("addrStreet").value = addr.street || "";
      document.getElementById("addrCity").value = addr.city || "";
      document.getElementById("addrState").value = addr.state || "";
      document.getElementById("addrPincode").value = addr.pincode || "";
      document.getElementById("addrDefault").checked = !!addr.is_default;
      showToast("Editing address", "ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  list.querySelectorAll(".addrDeleteBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".address-card");
      const id = Number(card.getAttribute("data-id"));
      const ok = confirm("Delete this address?");
      if (!ok) return;
      try {
        await fetch(`/api/addresses/${id}`, { method: "DELETE", credentials: "same-origin" }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Delete failed");
          return data;
        });
        showToast("Address deleted", "ok");
        clearAddressForm();
        await loadAddresses();
      } catch (err) {
        showToast(err.message, "bad");
      }
    });
  });
}

function setupAddresses() {
  const form = document.getElementById("addressForm");
  const clearBtn = document.getElementById("clearAddressBtn");
  if (!form || !clearBtn) return;

  clearBtn.addEventListener("click", () => clearAddressForm());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = (document.getElementById("addressId").value || "").trim();
    const payload = {
      full_name: document.getElementById("addrFullName").value.trim(),
      phone: document.getElementById("addrPhone").value.trim(),
      street: document.getElementById("addrStreet").value.trim(),
      city: document.getElementById("addrCity").value.trim(),
      state: document.getElementById("addrState").value.trim(),
      pincode: document.getElementById("addrPincode").value.trim(),
      is_default: document.getElementById("addrDefault").checked,
    };

    try {
      if (id) {
        await jsonFetch(`/api/addresses/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Address updated", "ok");
      } else {
        await jsonFetch("/api/addresses", { method: "POST", body: JSON.stringify(payload) });
        showToast("Address saved", "ok");
      }
      clearAddressForm();
      await loadAddresses();
    } catch (err) {
      showToast(err.message, "bad");
    }
  });

  loadAddresses();
}

function setupPasswordChange() {
  const form = document.getElementById("changePasswordForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current_password = document.getElementById("currentPassword").value;
    const new_password = document.getElementById("newPassword").value;
    const confirm_password = document.getElementById("confirmPassword").value;

    if (!current_password || !new_password || !confirm_password) {
      showToast("Please fill all password fields.", "warn");
      return;
    }
    if (new_password.length < 4) {
      showToast("New password must be at least 4 characters.", "warn");
      return;
    }
    if (new_password !== confirm_password) {
      showToast("New password and confirm password do not match.", "warn");
      return;
    }

    try {
      await jsonFetch("/api/profile/password", {
        method: "POST",
        body: JSON.stringify({ current_password, new_password, confirm_password }),
      });
      showToast("Password updated successfully.", "ok");
      form.reset();
    } catch (err) {
      showToast(err.message, "bad");
    }
  });
}

async function loadRecentOrderSnapshot() {
  const wrap = document.getElementById("recentOrderWrap");
  if (!wrap) return;
  try {
    const data = await jsonFetch("/api/orders");
    const orders = data.orders || [];
    if (!orders.length) {
      wrap.innerHTML = `<div class="empty-state">No orders yet — your next outfit is waiting 💖</div>`;
      return;
    }
    const o = orders[0];
    const statusText = o.status === "Placed" ? "Processing" : o.status;
    wrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
        <div>
          <div style="font-weight:900;">Order #${o.id}</div>
          <div class="hint">Total: ₹${formatMoney(o.total_amount)} • ${escapeHtml(o.created_at)}</div>
        </div>
        <div class="badge ok">${escapeHtml(statusText)}</div>
      </div>
      <div class="soft-divider"></div>
      <div class="timeline">
        <div class="timeline-step active">Placed</div>
        <div class="timeline-step active">Packed</div>
        <div class="timeline-step">Shipped</div>
        <div class="timeline-step">Delivered</div>
      </div>
      <div class="hint" style="margin-top:10px;">Timeline is UI-only for the project demo.</div>
    `;
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
  }
}

function setupPreferences() {
  const saveBtn = document.getElementById("savePrefsBtn");
  const clearBtn = document.getElementById("clearPrefsBtn");
  const checks = Array.from(document.querySelectorAll(".prefCheck"));
  if (!saveBtn || !clearBtn || !checks.length) return;

  function load() {
    const raw = localStorage.getItem("fashionhub_prefs");
    const items = raw ? raw.split("|").filter(Boolean) : [];
    checks.forEach((c) => (c.checked = items.includes(c.value)));
  }

  function save() {
    const selected = checks.filter((c) => c.checked).map((c) => c.value);
    localStorage.setItem("fashionhub_prefs", selected.join("|"));
    showToast("Preferences saved (UI only).", "ok");
  }

  function clear() {
    localStorage.removeItem("fashionhub_prefs");
    checks.forEach((c) => (c.checked = false));
    showToast("Preferences cleared.", "ok");
  }

  saveBtn.addEventListener("click", save);
  clearBtn.addEventListener("click", clear);
  load();
}

function formatMoney(n) {
  const num = Number(n || 0);
  return num.toFixed(2);
}

document.addEventListener("DOMContentLoaded", () => {
  window.showToast = showToast;
  window.jsonFetch = jsonFetch;
  window.escapeHtml = escapeHtml;
  window.formatMoney = formatMoney;
  window.togglePassword = togglePassword;

  setupMobileMenu();
  setupLogout();
  setupLoginForm();
  setupRegisterForm();
  setupNewsletter();
  loadProfile();
});

