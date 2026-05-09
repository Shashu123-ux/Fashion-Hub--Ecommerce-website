async function loadCartPage() {
  const wrap = document.getElementById("cartItemsWrap");
  const totalEl = document.getElementById("cartTotal");
  const checkoutBtn = document.getElementById("goCheckoutBtn");
  if (!wrap || !totalEl) return;

  try {
    const data = await jsonFetch("/api/cart");
    const items = data.items || [];
    totalEl.textContent = "₹" + formatMoney(data.total || 0);

    if (!items.length) {
      wrap.innerHTML = `
        <div class="empty-state">Your cart is waiting to be styled 💖</div>
        <div style="margin-top: 12px; display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn primary" href="/products">Start shopping</a>
          <a class="btn" href="/products?category=Ethnic%20Elegance">Explore ethnic</a>
        </div>
      `;
      if (checkoutBtn) {
        checkoutBtn.style.pointerEvents = "none";
        checkoutBtn.style.opacity = "0.55";
      }
      return;
    }
    if (checkoutBtn) {
      checkoutBtn.style.pointerEvents = "";
      checkoutBtn.style.opacity = "";
    }

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Size</th>
            <th>Price</th>
            <th style="width: 140px">Qty</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr data-id="${it.cart_item_id}">
              <td style="display:flex; gap:10px; align-items:center;">
                <img src="${it.image_url || "/static/images/placeholder.svg"}" alt="" style="width:44px;height:56px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);" />
                <div>
                  <div><b>${escapeHtml(it.name)}</b></div>
                  <div class="hint">${escapeHtml(it.category)}</div>
                  <div class="hint">Stock: ${it.stock}</div>
                </div>
              </td>
              <td><b>${escapeHtml(it.size)}</b></td>
              <td>₹${formatMoney(it.price)}</td>
              <td>
                <input type="number" min="1" max="${Math.max(1, it.stock)}" value="${it.quantity}" class="cartQtyInput" style="width: 90px;" />
                <button type="button" class="btn cartUpdateBtn" style="margin-top:8px; padding:10px 12px;">Update</button>
              </td>
              <td>₹${formatMoney(it.line_total)}</td>
              <td>
                <button type="button" class="btn cartRemoveBtn" style="padding:10px 12px;">Remove</button>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll(".cartUpdateBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        const cartItemId = Number(tr.getAttribute("data-id"));
        const qty = Number(tr.querySelector(".cartQtyInput").value || 1);

        try {
          await jsonFetch("/api/cart/update", {
            method: "POST",
            body: JSON.stringify({ cart_item_id: cartItemId, quantity: qty }),
          });
          showToast("Cart updated", "ok");
          await loadCartPage();
        } catch (e) {
          showToast(e.message, "bad");
        }
      });
    });

    wrap.querySelectorAll(".cartRemoveBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tr = btn.closest("tr");
        const cartItemId = Number(tr.getAttribute("data-id"));
        try {
          await jsonFetch("/api/cart/remove", {
            method: "POST",
            body: JSON.stringify({ cart_item_id: cartItemId }),
          });
          showToast("Removed from cart", "ok");
          await loadCartPage();
        } catch (e) {
          showToast(e.message, "bad");
        }
      });
    });
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
    totalEl.textContent = "₹0.00";
  }
}

async function loadCheckoutPage() {
  const wrap = document.getElementById("checkoutItemsWrap");
  const totalEl = document.getElementById("checkoutTotal");
  const placeBtn = document.getElementById("placeOrderBtn");
  const mode = document.getElementById("paymentMode");
  const successPanel = document.getElementById("orderSuccessPanel");
  const successText = document.getElementById("orderSuccessText");
  if (!wrap || !totalEl || !placeBtn || !mode) return;

  async function refresh() {
    const data = await jsonFetch("/api/cart");
    const items = data.items || [];
    totalEl.textContent = "₹" + formatMoney(data.total || 0);

    if (!items.length) {
      wrap.innerHTML = `
        <div class="empty-state">Your cart is waiting to be styled 💖</div>
        <div style="margin-top: 12px"><a class="btn primary" href="/products">Start shopping</a></div>
      `;
      placeBtn.disabled = true;
      return;
    }

    placeBtn.disabled = false;

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Size</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td><b>${escapeHtml(it.name)}</b> <div class="hint">${escapeHtml(it.category)}</div></td>
              <td>${escapeHtml(it.size)}</td>
              <td>${it.quantity}</td>
              <td>₹${formatMoney(it.line_total)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  try {
    await refresh();
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
    placeBtn.disabled = true;
  }

  placeBtn.addEventListener("click", async () => {
    placeBtn.disabled = true;
    placeBtn.textContent = "Placing...";

    try {
      const data = await jsonFetch("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ payment_mode: mode.value }),
      });

      showToast("Order placed successfully", "ok");
      if (successPanel && successText) {
        successText.innerHTML = `Your order <b>#${data.order_id}</b> is confirmed. Total: <b>₹${formatMoney(
          data.total_amount
        )}</b> via <b>${escapeHtml(data.payment_mode)}</b>.`;
        successPanel.style.display = "block";
      }
      await refresh();
    } catch (e) {
      showToast(e.message, "bad");
    } finally {
      placeBtn.disabled = false;
      placeBtn.textContent = "Place Order";
    }
  });
}

async function loadOrdersPage() {
  const wrap = document.getElementById("ordersWrap");
  if (!wrap) return;

  try {
    const data = await jsonFetch("/api/orders");
    const orders = data.orders || [];

    if (!orders.length) {
      wrap.innerHTML = `
        <div class="empty-state">No orders yet — your style story starts here ✨</div>
        <div style="margin-top: 12px"><a class="btn primary" href="/products">Shop now</a></div>
      `;
      return;
    }

    wrap.innerHTML = orders
      .map((o) => {
        const tx = o.transaction || {};
        return `
          <div class="card" style="padding: 14px; margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
              <div>
                <div style="font-weight:900; font-size:16px;">Order #${o.id}</div>
                <div class="hint">Placed: ${escapeHtml(o.created_at)}</div>
              </div>
              <div>
                <div class="badge ok">${escapeHtml(o.status)}</div>
              </div>
            </div>

            <div style="margin-top: 12px;">
              <div class="hint"><b>Items</b></div>
              <div style="display:grid; gap:6px; margin-top:6px;">
                ${(o.items || [])
                  .map(
                    (it) =>
                      `<div>• ${escapeHtml(it.name)} — ${escapeHtml(it.size)} — Qty ${it.quantity} — ₹${formatMoney(
                        Number(it.price) * Number(it.quantity)
                      )}</div>`
                  )
                  .join("")}
              </div>
            </div>

            <div style="margin-top: 12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <div class="hint"><b>Total:</b> ₹${formatMoney(o.total_amount)}</div>
              <div class="hint"><b>Payment:</b> ${escapeHtml(tx.payment_mode || "-")} (${escapeHtml(tx.status || "-")})</div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    wrap.innerHTML = escapeHtml(e.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCartPage();
  loadCheckoutPage();
  loadOrdersPage();
});

