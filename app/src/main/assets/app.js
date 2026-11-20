const STORAGE_KEYS = {
  PRODUCTS: "kasirhp_products_v1",
  TRANSACTIONS: "kasirhp_transactions_v1"
};

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Mie Goreng Spesial", modal: 5500, harga: 10000, stok: 25 },
  { id: "p2", name: "Es Teh Manis", modal: 1500, harga: 4000, stok: 40 },
  { id: "p3", name: "Kopi Hitam", modal: 2500, harga: 6000, stok: 30 }
];

function readStorage(key, fallback) {
  try {
    if (window.AndroidKasir && typeof window.AndroidKasir.loadData === "function") {
      const raw = window.AndroidKasir.loadData(key, "");
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}

  try {
    const rawLocal = localStorage.getItem(key);
    if (rawLocal) return JSON.parse(rawLocal);
  } catch (e) {}

  return fallback;
}

function writeStorage(key, value) {
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
  } catch (e) {}

  try {
    if (window.AndroidKasir && typeof window.AndroidKasir.saveData === "function") {
      window.AndroidKasir.saveData(key, serialized);
    }
  } catch (e) {}
}

let products = readStorage(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
let transactions = readStorage(STORAGE_KEYS.TRANSACTIONS, []);
let cart = [];

function formatRupiah(num) {
  return "Rp " + Number(num || 0).toLocaleString("id-ID");
}

function saveAll() {
  writeStorage(STORAGE_KEYS.PRODUCTS, products);
  writeStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
}

// Navigasi Tab
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    renderAll();
  });
});

// Render Kasir
function renderKasirProducts() {
  const query = (document.getElementById("searchProduk").value || "").toLowerCase().trim();
  const container = document.getElementById("daftarProdukKasir");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-text">Produk tidak ditemukan.</p>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (p) => `
      <div class="produk-tile" onclick="addToCart('${p.id}')">
        <div>
          <div class="produk-nama">${p.name}</div>
          <div class="produk-harga">${formatRupiah(p.harga)}</div>
        </div>
        <div class="produk-stok">Stok: ${p.stok} | Laba: ${formatRupiah(p.harga - p.modal)}</div>
      </div>
    `
    )
    .join("");
}

window.addToCart = function (productId) {
  const prod = products.find((p) => p.id === productId);
  if (!prod) return;
  if (prod.stok <= 0) {
    alert("Stok produk habis!");
    return;
  }

  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    if (existing.qty >= prod.stok) {
      alert("Jumlah melebihi stok tersedia!");
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      modal: prod.modal,
      harga: prod.harga,
      qty: 1
    });
  }
  renderCart();
};

window.changeQty = function (productId, delta) {
  const idx = cart.findIndex((item) => item.id === productId);
  if (idx === -1) return;

  const prod = products.find((p) => p.id === productId);
  const nextQty = cart[idx].qty + delta;

  if (nextQty <= 0) {
    cart.splice(idx, 1);
  } else if (prod && nextQty > prod.stok) {
    alert("Jumlah melebihi stok tersedia!");
    return;
  } else {
    cart[idx].qty = nextQty;
  }
  renderCart();
};

function renderCart() {
  const listEl = document.getElementById("keranjangList");
  if (cart.length === 0) {
    listEl.innerHTML = `<p class="empty-text">Belum ada item dipilih.</p>`;
  } else {
    listEl.innerHTML = cart
      .map(
        (item) => `
        <div class="keranjang-item">
          <div>
            <strong>${item.name}</strong><br />
            <small>${formatRupiah(item.harga)} x ${item.qty} = ${formatRupiah(item.harga * item.qty)}</small>
          </div>
          <div class="qty-controls">
            <button class="qty-btn" type="button" onclick="changeQty('${item.id}', -1)">-</button>
            <span>${item.qty}</span>
            <button class="qty-btn" type="button" onclick="changeQty('${item.id}', 1)">+</button>
          </div>
        </div>
      `
      )
      .join("");
  }

  const totalBayar = cart.reduce((sum, item) => sum + item.harga * item.qty, 0);
  const totalModal = cart.reduce((sum, item) => sum + item.modal * item.qty, 0);
  const estimasiLaba = totalBayar - totalModal;

  const uangBayar = Number(document.getElementById("uangBayar").value || 0);
  const kembalian = Math.max(0, uangBayar - totalBayar);

  document.getElementById("totalBayar").textContent = formatRupiah(totalBayar);
  document.getElementById("kembalianText").textContent = formatRupiah(kembalian);
  document.getElementById("estimasiLaba").textContent = formatRupiah(estimasiLaba);
}

document.getElementById("searchProduk").addEventListener("input", renderKasirProducts);
document.getElementById("uangBayar").addEventListener("input", renderCart);

document.getElementById("btnProsesBayar").addEventListener("click", () => {
  if (cart.length === 0) {
    alert("Keranjang masih kosong!");
    return;
  }

  const totalBayar = cart.reduce((sum, item) => sum + item.harga * item.qty, 0);
  const totalModal = cart.reduce((sum, item) => sum + item.modal * item.qty, 0);
  const laba = totalBayar - totalModal;
  const uangBayar = Number(document.getElementById("uangBayar").value || 0);

  if (uangBayar > 0 && uangBayar < totalBayar) {
    alert("Uang diterima kurang dari total bayar!");
    return;
  }

  cart.forEach((item) => {
    const prod = products.find((p) => p.id === item.id);
    if (prod) {
      prod.stok = Math.max(0, prod.stok - item.qty);
    }
  });

  const trx = {
    id: "TRX-" + Date.now(),
    tanggal: new Date().toLocaleString("id-ID"),
    items: cart.map((i) => ({ name: i.name, qty: i.qty, harga: i.harga, modal: i.modal })),
    totalBayar,
    totalModal,
    laba,
    uangBayar: uangBayar || totalBayar
  };

  transactions.unshift(trx);
  cart = [];
  document.getElementById("uangBayar").value = "";
  saveAll();
  renderAll();
  alert("Transaksi berhasil disimpan!");
});

// Kelola Produk & HPP
document.getElementById("formProduk").addEventListener("submit", (e) => {
  e.preventDefault();
  const idVal = document.getElementById("produkId").value;
  const name = document.getElementById("namaProduk").value.trim();
  const modal = Number(document.getElementById("hargaModal").value || 0);
  const harga = Number(document.getElementById("hargaJual").value || 0);
  const stok = Number(document.getElementById("stokProduk").value || 0);

  if (!name) return;

  if (idVal) {
    const idx = products.findIndex((p) => p.id === idVal);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, modal, harga, stok };
    }
  } else {
    products.unshift({
      id: "p_" + Date.now(),
      name,
      modal,
      harga,
      stok
    });
  }

  resetFormProduk();
  saveAll();
  renderAll();
});

window.editProduk = function (id) {
  const prod = products.find((p) => p.id === id);
  if (!prod) return;

  document.getElementById("produkId").value = prod.id;
  document.getElementById("namaProduk").value = prod.name;
  document.getElementById("hargaModal").value = prod.modal;
  document.getElementById("hargaJual").value = prod.harga;
  document.getElementById("stokProduk").value = prod.stok;
  document.getElementById("btnSimpanProduk").textContent = "Update Produk";
};

window.deleteProduk = function (id) {
  if (!confirm("Hapus produk ini?")) return;
  products = products.filter((p) => p.id !== id);
  cart = cart.filter((c) => c.id !== id);
  saveAll();
  renderAll();
};

function resetFormProduk() {
  document.getElementById("produkId").value = "";
  document.getElementById("formProduk").reset();
  document.getElementById("btnSimpanProduk").textContent = "Simpan Produk";
}

document.getElementById("btnBatalEdit").addEventListener("click", resetFormProduk);

function renderKelolaProduk() {
  const el = document.getElementById("daftarProdukKelola");
  if (products.length === 0) {
    el.innerHTML = `<p class="empty-text">Belum ada produk.</p>`;
    return;
  }

  el.innerHTML = products
    .map((p) => {
      const margin = p.harga - p.modal;
      return `
        <div class="kelola-item">
          <div>
            <strong>${p.name}</strong>
            <div class="kelola-meta">
              HPP: ${formatRupiah(p.modal)} | Jual: ${formatRupiah(p.harga)} | Laba: ${formatRupiah(margin)} | Stok: ${p.stok}
            </div>
          </div>
          <div class="kelola-actions">
            <button class="btn btn-edit" type="button" onclick="editProduk('${p.id}')">Edit</button>
            <button class="btn btn-danger" type="button" onclick="deleteProduk('${p.id}')">Hapus</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Riwayat & Statistik
function renderRiwayat() {
  const omzet = transactions.reduce((s, t) => s + t.totalBayar, 0);
  const modal = transactions.reduce((s, t) => s + t.totalModal, 0);
  const laba = transactions.reduce((s, t) => s + t.laba, 0);

  document.getElementById("statOmzet").textContent = formatRupiah(omzet);
  document.getElementById("statModal").textContent = formatRupiah(modal);
  document.getElementById("statLaba").textContent = formatRupiah(laba);

  const listEl = document.getElementById("riwayatList");
  if (transactions.length === 0) {
    listEl.innerHTML = `<p class="empty-text">Belum ada transaksi tercatat.</p>`;
    return;
  }

  listEl.innerHTML = transactions
    .map(
      (t) => `
      <div class="riwayat-item">
        <div class="riwayat-top">
          <span>${t.id}</span>
          <span>${formatRupiah(t.totalBayar)}</span>
        </div>
        <small>${t.tanggal} • Laba: ${formatRupiah(t.laba)}</small>
        <div class="kelola-meta">
          ${t.items.map((i) => `${i.name} (${i.qty}x)`).join(", ")}
        </div>
      </div>
    `
    )
    .join("");
}

document.getElementById("btnResetDemo").addEventListener("click", () => {
  if (!confirm("Reset semua data produk dan riwayat transaksi ke awal?")) return;
  products = DEFAULT_PRODUCTS.map((p) => ({ ...p }));
  transactions = [];
  cart = [];
  saveAll();
  renderAll();
});

function renderAll() {
  renderKasirProducts();
  renderCart();
  renderKelolaProduk();
  renderRiwayat();
}

renderAll();
