function stockBadgeInfo(stock) {
  const s = Number(stock || 0);
  if (s <= 0) return { text: "Out of stock", cls: "out" };
  if (s <= 5) return { text: "Low stock", cls: "low" };
  return { text: "In stock", cls: "ok" };
}

function adminStockBadge(stock) {
  const b = stockBadgeInfo(stock);
  return `<span class="badge ${b.cls}">${b.text} (${stock})</span>`;
}

async function loadAdminStats() {
  const u = document.getElementById("kpiUsers");
  const o = document.getElementById("kpiOrders");
  const r = document.getElementById("kpiRevenue");
  if (!u || !o || !r) return;

  try {
    const data = await jsonFetch("/api/admin/stats");
    u.textContent = data.total_users;
    o.textContent = data.total_orders;
    r.textContent = "₹" + formatMoney(data.revenue);
  } catch (e) {
    showToast(e.message, "bad");
  }
}

async function loadAdminProducts() {
  const wrap = document.getElementById("adminProductsWrap");
  if (!wrap) return;

  try {
    const data = await jsonFetch("/api/products");
    const items = data.products || [];

    if (!items.length) {
      wrap.innerHTML = "No products found.";
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (p) => `
              <tr data-id="${p.id}">
                <td>${p.id}</td>
                <td><b>${escapeHtml(p.name)}</b></td>
                <td>${escapeHtml(p.category)}</td>
                <td>₹${formatMoney(p.price)}</td>
                <td>${adminStockBadge(p.stock)}</td>
                <td style="display:flex; gap:8px; justify-content:flex-end;">
                  <button type="button" class="btn editBtn" style="padding:10px 12px;">Edit</button>
                  <button type="button" class="btn delBtn" style="padding:10px 12px;">Delete</button>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    wrap.querySelectorAll(".editBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.closest("tr").getAttribute("data-id"));
        await loadProductIntoForm(id);
      });
    });

    wrap.querySelectorAll(".delBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.closest("tr").getAttribute("data-id"));
        const ok = confirm("Delete product #" + id + "?");
        if (!ok) return;
        try {
          await fetch(`/api/admin/products/${id}`, {
            method: "DELETE",
            credentials: "same-origin",
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Delete failed");
            return data;
          });
          showToast("Product deleted", "ok");
          await loadAdminProducts();
        } catch (e) {
          showToast(e.message, "bad");
        }
      });
    });
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
  }
}

async function loadProductIntoForm(productId) {
  const idEl = document.getElementById("productId");
  const nameEl = document.getElementById("pName");
  const catEl = document.getElementById("pCategory");
  const priceEl = document.getElementById("pPrice");
  const stockEl = document.getElementById("pStock");
  const descEl = document.getElementById("pDesc");
  const imgEl = document.getElementById("pImages");
  const detailsEl = document.getElementById("pDetails");
  const discountEl = document.getElementById("pDiscount");

  if (!idEl) return;

  try {
    const data = await jsonFetch(`/api/products/${productId}`);
    const p = data.product;
    idEl.value = String(p.id);
    nameEl.value = p.name;
    catEl.value = p.category;
    priceEl.value = String(p.price);
    stockEl.value = String(p.stock);
    descEl.value = p.description;
    detailsEl.value = p.details || "";
    discountEl.value = p.discount || 0;
    imgEl.value = (p.images || []).join(", ");
    showToast("Editing product #" + p.id, "ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    showToast(e.message, "bad");
  }
}

function clearProductForm() {
  document.getElementById("productId").value = "";
  document.getElementById("pName").value = "";
  document.getElementById("pCategory").value = "Ethnic Elegance";
  document.getElementById("pPrice").value = "999";
  document.getElementById("pStock").value = "10";
  document.getElementById("pDesc").value = "";
  document.getElementById("pDetails").value =
    "Fabric: \nFit: \nOccasion: \nCare: ";
  document.getElementById("pDiscount").value = "0";

  document.getElementById("pImages").value =
    "/static/images/placeholder.svg, /static/images/placeholder.svg, /static/images/placeholder.svg";
}

function setupAdminProductForm() {
  const form = document.getElementById("productForm");
  if (!form) return;

  const clearBtn = document.getElementById("clearFormBtn");
  clearBtn.addEventListener("click", () => clearProductForm());

  if (!document.getElementById("pImages").value) {
    clearProductForm();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const productId = (document.getElementById("productId").value || "").trim();
    const payload = {
      name: document.getElementById("pName").value.trim(),
      category: document.getElementById("pCategory").value.trim(),
      price: Number(document.getElementById("pPrice").value || 0),
      stock: Number(document.getElementById("pStock").value || 0),
      description: document.getElementById("pDesc").value.trim(),
      details: document.getElementById("pDetails").value.trim(),
      discount: Number(document.getElementById("pDiscount").value || 0),
      image_urls: document
        .getElementById("pImages")
        .value.split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };

    try {
      if (productId) {
        await jsonFetch(`/api/admin/products/${productId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Product updated", "ok");
      } else {
        await jsonFetch("/api/admin/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Product added", "ok");
      }

      clearProductForm();
      await loadAdminStats();
      await loadAdminProducts();
    } catch (e2) {
      showToast(e2.message, "bad");
    }
  });
}

async function loadAdminUsers() {
  const wrap = document.getElementById("adminUsersWrap");
  if (!wrap) return;

  try {
    const data = await jsonFetch("/api/admin/users");
    const users = data.users || [];

    wrap.innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map(
                (u) => `
              <tr>
                <td>${u.id}</td>
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${escapeHtml(u.role)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
  }
}

async function loadAdminOrders() {
  const wrap = document.getElementById("adminOrdersWrap");
  if (!wrap) return;

  try {
    const data = await jsonFetch("/api/admin/orders");
    const orders = data.orders || [];

    wrap.innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>User</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (o) => `
              <tr>
                <td>#${o.id}</td>
                <td>
                  <b>${escapeHtml(o.user_name)}</b>
                  <div class="hint">${escapeHtml(o.user_email)}</div>
                </td>
                <td>₹${formatMoney(o.total_amount)}</td>
                <td>${escapeHtml(o.status)}</td>
                <td class="hint">${escapeHtml(o.created_at)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupAdminProductForm();
  await loadAdminStats();
  await loadAdminProducts();
  await loadAdminUsers();
  await loadAdminOrders();
});
