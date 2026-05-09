function stockBadgeInfo(stock) {
  const s = Number(stock || 0);
  if (s <= 0) return { text: "Out of stock", cls: "out" };
  if (s <= 5) return { text: "Low stock", cls: "low" };
  return { text: "In stock", cls: "ok" };
}

function productCardHtml(p) {
  const img =
    p.images && p.images.length
      ? p.images[0]
      : "/static/images/placeholder.svg";
  const badge = stockBadgeInfo(p.stock);

  return `
    <a class="card product-card" href="/product/${p.id}">
      <div class="product-img">
        <img src="${img}" alt="${escapeHtml(p.name)}" loading="lazy" />
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-meta">
          <div class="price">₹${formatMoney(p.price)}</div>
          <div class="badge ${badge.cls}">${badge.text}</div>
        </div>
        <div class="hint">${escapeHtml(p.category)}</div>
      </div>
    </a>
  `;
}

function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem("fashionhub_recently_viewed");
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch (e) {
    return [];
  }
}

function saveRecentlyViewed(product) {
  if (!product || !product.id) return;

  const item = {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    image_url:
      (product.images && product.images[0]) || "/static/images/placeholder.svg",
  };

  const items = getRecentlyViewed().filter((x) => x && x.id !== item.id);
  items.unshift(item);
  const trimmed = items.slice(0, 8);
  localStorage.setItem("fashionhub_recently_viewed", JSON.stringify(trimmed));
}

function renderRecentlyViewed(currentProductId) {
  const grid = document.getElementById("recentlyViewedGrid");
  const empty = document.getElementById("recentlyViewedEmpty");
  if (!grid || !empty) return;

  const items = getRecentlyViewed()
    .filter((x) => x && x.id !== currentProductId)
    .slice(0, 4);

  if (!items.length) {
    empty.style.display = "block";
    grid.innerHTML = "";
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = items
    .map((x) =>
      productCardHtml({
        id: x.id,
        name: x.name,
        category: x.category,
        price: x.price,
        stock: 1,
        images: [x.image_url],
      }),
    )
    .join("");
}

async function loadFeatured() {
  const grid = document.getElementById("featuredProductsGrid");
  if (!grid) return;

  try {
    const data = await jsonFetch("/api/products");
    const items = (data.products || []).slice(0, 8);
    grid.innerHTML = items.map(productCardHtml).join("");
  } catch (e) {
    grid.innerHTML = `<div class="hint">Failed to load products: ${escapeHtml(e.message)}</div>`;
  }
}

async function loadProductsPage() {
  const grid = document.getElementById("productsGrid");
  const empty = document.getElementById("productsEmpty");
  if (!grid || !empty) return;

  const categorySelect = document.getElementById("categorySelect");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const title = document.getElementById("productsTitle");
  const subtitle = document.getElementById("productsSubtitle");

  const initialCategory = (window.__initialCategory || "").trim();
  const urlParams = new URLSearchParams(window.location.search);
  const urlCategory = (urlParams.get("category") || "").trim();
  const urlQuery = (urlParams.get("q") || "").trim();

  try {
    const cats = await jsonFetch("/api/categories");
    (cats.categories || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categorySelect.appendChild(opt);
    });
  } catch (e) {
    // category dropdown is optional
  }

  const selectedCategory = urlCategory || initialCategory || "";
  if (selectedCategory) categorySelect.value = selectedCategory;
  if (urlQuery) searchInput.value = urlQuery;

  async function runSearch() {
    const category = (categorySelect.value || "").trim();
    const q = (searchInput.value || "").trim();

    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);

    const newUrl =
      "/products" + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", newUrl);

    if (category) {
      title.textContent = category;
      subtitle.textContent =
        "Browse " + category + " styles for modern Indian women.";
    } else {
      title.textContent = "Shop";
      subtitle.textContent = "Browse category-wise, add to cart, and checkout.";
    }

    grid.innerHTML = "";
    empty.style.display = "none";

    try {
      const data = await jsonFetch(
        "/api/products" + (params.toString() ? "?" + params.toString() : ""),
      );
      const items = data.products || [];
      if (!items.length) {
        empty.style.display = "block";
        return;
      }
      grid.innerHTML = items.map(productCardHtml).join("");
    } catch (e) {
      empty.style.display = "block";
      empty.textContent = "Failed to load products: " + e.message;
    }
  }

  categorySelect.addEventListener("change", runSearch);
  searchBtn.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  await runSearch();
}


async function loadProductDetail() {
  const productId = window.__productId;
  if (!productId) return;

  const nameEl = document.getElementById("productName");
  const priceEl = document.getElementById("productPrice");
  const badgeEl = document.getElementById("stockBadge");
  const mainImage = document.getElementById("mainImage");
  const thumbsRow = document.getElementById("thumbsRow");
  const sizesRow = document.getElementById("sizesRow");
  const qtyInput = document.getElementById("qtyInput");
  const qtyHint = document.getElementById("qtyHint");
  const addBtn = document.getElementById("addToCartBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const descEl = document.getElementById("productDesc");
  const detailsEl = document.getElementById("detailsList");
  const bc = document.getElementById("detailBreadcrumbs");

  if (
    !nameEl ||
    !priceEl ||
    !badgeEl ||
    !mainImage ||
    !thumbsRow ||
    !sizesRow ||
    !qtyInput ||
    !addBtn ||
    !buyBtn
  ) {
    return;
  }

  try {
    const data = await jsonFetch(`/api/products/${productId}`);
    const p = data.product;

    saveRecentlyViewed(p);
    renderRecentlyViewed(p.id);

    const imgs =
      p.images && p.images.length
        ? p.images
        : ["/static/images/placeholder.svg"];
    mainImage.src = imgs[0];
    thumbsRow.innerHTML = imgs
      .map(
        (u, i) => `
          <div class="thumb ${i === 0 ? "active" : ""}" data-idx="${i}">
            <img src="${u}" alt="Thumbnail ${i + 1}" />
          </div>
        `,
      )
      .join("");

    thumbsRow.querySelectorAll(".thumb").forEach((t) => {
      t.addEventListener("click", () => {
        thumbsRow
          .querySelectorAll(".thumb")
          .forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        const idx = Number(t.getAttribute("data-idx"));
        mainImage.src = imgs[idx] || imgs[0];
      });
    });

    nameEl.textContent = p.name;
    const badge = stockBadgeInfo(p.stock);
    badgeEl.textContent = badge.text + ` (${p.stock})`;
    badgeEl.className = "badge " + badge.cls;

    const discount = Number(p.discount || 0);

    if (discount > 0) {
      const newPrice = Number(p.price) * (1 - discount / 100);
      priceEl.innerHTML = `
    ₹${formatMoney(newPrice)}
    <span class="hint" style="text-decoration: line-through; margin-left: 8px;">
      ₹${formatMoney(p.price)}
    </span>
    <span class="badge" style="margin-left: 8px;">
      ${discount}% OFF
    </span>
  `;
    } else {
      priceEl.textContent = "₹" + formatMoney(p.price);
    }

    if (bc) {
      bc.innerHTML = `<a href="/">Home</a> <span>›</span> <a href="/products">Products</a> <span>›</span> <a href="/products?category=${encodeURIComponent(
        p.category,
      )}">${escapeHtml(p.category)}</a> <span>›</span> <span>${escapeHtml(p.name)}</span>`;
    }

   if (p.details && p.details.trim()) {
  detailsEl.innerHTML = p.details
    .split("\n")
    .map(line => `<div>${escapeHtml(line)}</div>`)
    .join("");
} else {
  detailsEl.innerHTML = `<div class="hint">No additional details for this product.</div>`;
}


    descEl.textContent = p.description;

    const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
    let selectedSize = "M";

    function renderSizes() {
      sizesRow.innerHTML = sizes
        .map(
          (s) =>
            `<button type="button" class="size-btn ${s === selectedSize ? "active" : ""}" data-size="${s}">${s}</button>`,
        )
        .join("");
      sizesRow.querySelectorAll(".size-btn").forEach((b) => {
        b.addEventListener("click", () => {
          selectedSize = b.getAttribute("data-size");
          renderSizes();
        });
      });
    }

    renderSizes();

    const stock = Number(p.stock || 0);
    qtyInput.min = "1";
    qtyInput.max = stock > 0 ? String(stock) : "1";
    qtyInput.value = "1";

    function refreshQtyHint() {
      if (stock <= 0) {
        qtyHint.textContent = "Currently out of stock";
        return;
      }
      qtyHint.textContent = `Max: ${stock}`;
      const v = Number(qtyInput.value || 1);
      if (v > stock) qtyInput.value = String(stock);
      if (v < 1) qtyInput.value = "1";
    }

    qtyInput.addEventListener("input", refreshQtyHint);
    refreshQtyHint();

    function setButtonsDisabled(disabled) {
      addBtn.disabled = disabled;
      buyBtn.disabled = disabled;
    }

    setButtonsDisabled(stock <= 0);

    async function addToCart() {
      const qty = Number(qtyInput.value || 1);
      try {
        await jsonFetch("/api/cart/add", {
          method: "POST",
          body: JSON.stringify({
            product_id: p.id,
            size: selectedSize,
            quantity: qty,
          }),
        });
        showToast("Added to cart", "ok");
        return true;
      } catch (e) {
        if (String(e.message).toLowerCase().includes("login")) {
          showToast("Please login to add items to cart", "warn");
          setTimeout(() => (window.location.href = "/login"), 350);
          return false;
        }
        showToast(e.message, "bad");
        return false;
      }
    }

    addBtn.addEventListener("click", addToCart);
    buyBtn.addEventListener("click", async () => {
      const ok = await addToCart();
      if (ok) window.location.href = "/checkout";
    });
  } catch (e) {
    showToast(e.message, "bad");
    nameEl.textContent = "Product not found";
    badgeEl.textContent = "Unavailable";
    badgeEl.className = "badge out";
    addBtn.disabled = true;
    buyBtn.disabled = true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadFeatured();
  loadProductsPage();
  loadProductDetail();
});
