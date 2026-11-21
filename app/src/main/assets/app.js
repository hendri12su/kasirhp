const STORAGE_KEY = "kasir_hp_pos_v2";

const DEFAULT_DATA = {
  settings: {
    owner: "Hendri S",
    toko: "Toko",
  },
  categories: ["Umum", "Makanan", "Minuman", "Liquid / Vape", "Jasa"],
  products: [
    { id: "p1", name: "Mie Goreng Spesial", category: "Makanan", cost: 5500, price: 10000, stock: 25 },
    { id: "p2", name: "Es Teh Manis", category: "Minuman", cost: 1500, price: 4000, stock: 40 },
    { id: "p3", name: "Kopi Hitam", category: "Minuman", cost: 2500, price: 6000, stock: 30 },
  ],
  transactions: [],
  purchases: [],
  expenses: [],
  debts: [],
  cashflows: [],
};

let state = loadState();
let cart = [];

function loadState() {
  try {
    let raw = "";
    if (window.AndroidKasir && typeof window.AndroidKasir.loadData === "function") {
      raw = window.AndroidKasir.loadData();
    } else {
      raw = localStorage.getItem(STORAGE_KEY) || "";
    }
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings || structuredClone(DEFAULT_DATA.settings),
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : [...DEFAULT_DATA.categories],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      cashflows: Array.isArray(parsed.cashflows) ? parsed.cashflows : [],
    };
  } catch (e) {
    return structuredClone(DEFAULT_DATA);
  }
}

function saveState() {
  const json = JSON.stringify(state);
  try {
    if (window.AndroidKasir && typeof window.AndroidKasir.saveData === "function") {
      window.AndroidKasir.saveData(json);
    }
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.error("Gagal menyimpan:", e);
  }
}

function rupiah(n) {
  const val = Number(n) || 0;
  return "Rp " + val.toLocaleString("id-ID");
}

function nowStr() {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

/* DRAWER & NAVIGATION */
const sideDrawer = document.getElementById("sideDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");

function openDrawer() {
  sideDrawer.classList.add("open");
  drawerOverlay.classList.add("open");
}

function closeDrawer() {
  sideDrawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
}

document.getElementById("btnOpenDrawer").addEventListener("click", openDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
document.getElementById("btnQuickHome").addEventListener("click", () => navigateTo("home"));
document.getElementById("btnQuickLock").addEventListener("click", () => {
  closeDrawer();
  alert("Layar kasir terkunci sementara. Tekan OK untuk lanjut jualan.");
});

function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById("page-" + pageId);
  if (target) target.classList.add("active");

  document.querySelectorAll(".menu-item").forEach((btn) => {
    const active = btn.dataset.page === pageId;
    btn.classList.toggle("active", active);
    if (active) {
      document.getElementById("headerSubPage").textContent = btn.textContent.trim();
    }
  });

  closeDrawer();
  renderAll();
}

document.querySelectorAll(".menu-item").forEach((btn) => {
  btn.addEventListener("click", () => navigateTo(btn.dataset.page));
});

/* RENDER ALL SECTIONS */
function renderAll() {
  renderProfile();
  renderHome();
  renderKasirProducts();
  renderCart();
  renderDaftarTransaksi();
  renderProdukPage();
  renderPembelianPage();
  renderPengeluaranPage();
  renderArusKasPage();
  renderUtangPage();
  renderMasterPage();
  renderLaporanPage();
}

function renderProfile() {
  const owner = state.settings.owner || "Hendri S";
  const toko = state.settings.toko || "Toko";
  document.getElementById("drawerOwner").textContent = owner;
  document.getElementById("drawerStoreBadge").textContent = toko;
  document.getElementById("headerNamaToko").textContent = `${toko} ${owner}`;
  document.getElementById("setOwner").value = owner;
  document.getElementById("setToko").value = toko;
}

/* 1. HOME */
function renderHome() {
  const today = todayPrefix();
  let omzetToday = 0;
  let labaToday = 0;

  state.transactions.forEach((t) => {
    if ((t.isoDate || "").startsWith(today)) {
      omzetToday += Number(t.total) || 0;
      labaToday += Number(t.profit) || 0;
    }
  });

  const saldo = calcSaldoKas();
  document.getElementById("homeOmzetHariIni").textContent = rupiah(omzetToday);
  document.getElementById("homeLabaHariIni").textContent = "Laba Bersih: " + rupiah(labaToday);
  document.getElementById("homeSaldoKas").textContent = rupiah(saldo);

  const recentEl = document.getElementById("homeRecentTrx");
  const latest = state.transactions.slice(0, 5);
  if (!latest.length) {
    recentEl.innerHTML = `<div class="empty-msg">Belum ada transaksi tercatat.</div>`;
    return;
  }

  recentEl.innerHTML = latest
    .map(
      (t) => `
      <div class="list-row">
        <div>
          <strong>${t.label}</strong><br />
          <small class="p-meta">${t.date} • ${t.method || "Tunai"}</small>
        </div>
        <div style="text-align:right">
          <strong class="green">${rupiah(t.total)}</strong><br />
          <small class="p-meta">Laba ${rupiah(t.profit)}</small>
        </div>
      </div>`
    )
    .join("");
}

/* 2. TRANSAKSI BARU */
document.getElementById("searchProdukKasir").addEventListener("input", renderKasirProducts);
document.getElementById("filterKategoriKasir").addEventListener("change", renderKasirProducts);
document.getElementById("inputDiskon").addEventListener("input", renderCart);
document.getElementById("kasirUangBayar").addEventListener("input", renderCart);

function renderKasirProducts() {
  const q = (document.getElementById("searchProdukKasir").value || "").toLowerCase();
  const cat = document.getElementById("filterKategoriKasir").value;

  const filterSelect = document.getElementById("filterKategoriKasir");
  const currentCat = filterSelect.value;
  filterSelect.innerHTML =
    `<option value="">Semua Kategori</option>` +
    state.categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  filterSelect.value = currentCat;

  const list = state.products.filter((p) => {
    const matchName = p.name.toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    return matchName && matchCat;
  });

  const grid = document.getElementById("gridProdukKasir");
  if (!list.length) {
    grid.innerHTML = `<div class="empty-msg" style="grid-column:span 2">Produk tidak ditemukan.</div>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (p) => `
      <div class="p-card" onclick="addToCart('${p.id}')">
        <strong>${p.name}</strong>
        <span class="p-price">${rupiah(p.price)}</span>
        <span class="p-meta">${p.category} • Stok: ${p.stock}</span>
      </div>`
    )
    .join("");
}

window.addToCart = function (productId) {
  const prod = state.products.find((p) => p.id === productId);
  if (!prod) return;
  if (prod.stock <= 0) {
    alert("Stok " + prod.name + " habis!");
    return;
  }
  const existing = cart.find((c) => c.id === productId);
  if (existing) {
    if (existing.qty + 1 > prod.stock) {
      alert("Stok tidak mencukupi.");
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      cost: Number(prod.cost) || 0,
      price: Number(prod.price) || 0,
      qty: 1,
    });
  }
  renderCart();
};

window.changeCartQty = function (idx, delta) {
  const item = cart[idx];
  if (!item) return;
  const prod = state.products.find((p) => p.id === item.id);
  const nextQty = item.qty + delta;
  if (nextQty <= 0) {
    cart.splice(idx, 1);
  } else if (prod && nextQty > prod.stock) {
    alert("Melebihi sisa stok (" + prod.stock + ")");
    return;
  } else {
    item.qty = nextQty;
  }
  renderCart();
};

function getCartTotals() {
  let subtotal = 0;
  let totalCost = 0;
  cart.forEach((c) => {
    subtotal += c.price * c.qty;
    totalCost += c.cost * c.qty;
  });
  const diskon = Math.max(0, Number(document.getElementById("inputDiskon").value) || 0);
  const total = Math.max(0, subtotal - diskon);
  const profit = total - totalCost;
  return { subtotal, diskon, total, totalCost, profit };
}

window.setUangPas = function () {
  const { total } = getCartTotals();
  document.getElementById("kasirUangBayar").value = total;
  renderCart();
};

window.tambahUang = function (nominal) {
  const current = Number(document.getElementById("kasirUangBayar").value) || 0;
  document.getElementById("kasirUangBayar").value = current + nominal;
  renderCart();
};

function renderCart() {
  const box = document.getElementById("keranjangContainer");
  if (!cart.length) {
    box.innerHTML = `<div class="empty-msg">Belum ada item di keranjang.</div>`;
  } else {
    box.innerHTML = cart
      .map(
        (c, i) => `
        <div class="list-row">
          <div>
            <strong>${c.name}</strong><br />
            <small class="p-meta">${rupiah(c.price)} x ${c.qty}</small>
          </div>
          <div class="row-actions">
            <button type="button" class="mini-btn mini-del" onclick="changeCartQty(${i}, -1)">-</button>
            <strong style="padding:2px 6px">${c.qty}</strong>
            <button type="button" class="mini-btn mini-ok" onclick="changeCartQty(${i}, 1)">+</button>
          </div>
        </div>`
      )
      .join("");
  }

  const { total, profit } = getCartTotals();
  const bayar = Number(document.getElementById("kasirUangBayar").value) || 0;
  const kembali = Math.max(0, bayar - total);

  document.getElementById("kasirTotalAkhir").textContent = rupiah(total);
  document.getElementById("kasirEstimasiLaba").textContent = rupiah(profit);
  document.getElementById("kasirKembalian").textContent = rupiah(kembali);
}

document.getElementById("btnSimpanTrxBaru").addEventListener("click", () => {
  if (!cart.length) {
    alert("Pilih minimal 1 produk terlebih dahulu.");
    return;
  }

  const { total, totalCost, profit, diskon } = getCartTotals();
  const method = document.getElementById("metodeBayar").value;
  const note = document.getElementById("catatanTrx").value.trim();
  const bayar = Number(document.getElementById("kasirUangBayar").value) || 0;

  if (method !== "Utang" && bayar < total) {
    alert("Uang diterima masih kurang dari total bayar!");
    return;
  }

  // Kurangi stok produk
  cart.forEach((c) => {
    const prod = state.products.find((p) => p.id === c.id);
    if (prod) prod.stock = Math.max(0, prod.stock - c.qty);
  });

  const summaryName = cart.map((c) => `${c.name} (${c.qty}x)`).join(", ");
  const trx = {
    id: "TRX-" + Date.now(),
    date: nowStr(),
    isoDate: new Date().toISOString(),
    label: note ? `${note} — ${summaryName}` : summaryName,
    items: structuredClone(cart),
    discount: diskon,
    total,
    cost: totalCost,
    profit,
    method,
  };

  state.transactions.unshift(trx);

  if (method === "Utang") {
    state.debts.unshift({
      id: "UTG-" + Date.now(),
      type: "Piutang Pelanggan",
      name: note || "Pelanggan Kasbon",
      amount: total,
      note: summaryName,
      paid: false,
      date: nowStr(),
    });
  } else {
    state.cashflows.unshift({
      id: "KAS-" + Date.now(),
      type: "masuk",
      title: "Penjualan: " + trx.label,
      amount: total,
      date: nowStr(),
    });
  }

  cart = [];
  document.getElementById("inputDiskon").value = 0;
  document.getElementById("kasirUangBayar").value = "";
  document.getElementById("catatanTrx").value = "";
  saveState();
  renderAll();
  alert("Transaksi berhasil disimpan!");
});

/* 3. TRANSAKSI CEPAT */
document.getElementById("formTrxCepat").addEventListener("submit", (e) => {
  e.preventDefault();
  const nama = document.getElementById("cepatNama").value.trim();
  const harga = Number(document.getElementById("cepatHarga").value) || 0;
  const modal = Number(document.getElementById("cepatModal").value) || 0;
  const cat = document.getElementById("cepatCatatan").value.trim();

  if (!nama || harga <= 0) return;

  const profit = harga - modal;
  const label = cat ? `${nama} (${cat})` : nama;

  state.transactions.unshift({
    id: "TRX-" + Date.now(),
    date: nowStr(),
    isoDate: new Date().toISOString(),
    label,
    items: [],
    discount: 0,
    total: harga,
    cost: modal,
    profit,
    method: "Transaksi Cepat",
  });

  state.cashflows.unshift({
    id: "KAS-" + Date.now(),
    type: "masuk",
    title: "Transaksi Cepat: " + label,
    amount: harga,
    date: nowStr(),
  });

  e.target.reset();
  saveState();
  renderAll();
  alert("Transaksi cepat berhasil disimpan!");
});

/* 4. DAFTAR TRANSAKSI */
function renderDaftarTransaksi() {
  const el = document.getElementById("listDaftarTrx");
  if (!state.transactions.length) {
    el.innerHTML = `<div class="empty-msg">Belum ada riwayat transaksi.</div>`;
    return;
  }

  el.innerHTML = state.transactions
    .map(
      (t, idx) => `
      <div class="list-row">
        <div>
          <strong>${t.label}</strong><br />
          <small class="p-meta">${t.date} • ${t.method}</small><br />
          <strong class="green">${rupiah(t.total)}</strong> <small class="p-meta">(Laba: ${rupiah(t.profit)})</small>
        </div>
        <button class="mini-btn mini-del" onclick="deleteTrx(${idx})">Hapus</button>
      </div>`
    )
    .join("");
}

window.deleteTrx = function (idx) {
  if (!confirm("Hapus riwayat transaksi ini?")) return;
  state.transactions.splice(idx, 1);
  saveState();
  renderAll();
};

/* 5. PRODUK */
function renderProdukPage() {
  const catSel = document.getElementById("prodKategori");
  catSel.innerHTML = state.categories.map((c) => `<option value="${c}">${c}</option>`).join("");

  const listEl = document.getElementById("listKelolaProduk");
  if (!state.products.length) {
    listEl.innerHTML = `<div class="empty-msg">Belum ada produk.</div>`;
    return;
  }

  listEl.innerHTML = state.products
    .map(
      (p) => `
      <div class="list-row">
        <div>
          <strong>${p.name}</strong> <small class="p-meta">[${p.category}]</small><br />
          <small class="p-meta">Modal: ${rupiah(p.cost)} | Jual: ${rupiah(p.price)} | Stok: <b>${p.stock}</b></small>
        </div>
        <div class="row-actions">
          <button class="mini-btn mini-ok" onclick="quickRestock('${p.id}', 5)">+5</button>
          <button class="mini-btn mini-edit" onclick="editProduk('${p.id}')">Edit</button>
          <button class="mini-btn mini-del" onclick="hapusProduk('${p.id}')">Hapus</button>
        </div>
      </div>`
    )
    .join("");
}

document.getElementById("formProduk").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("editProdukId").value;
  const name = document.getElementById("prodNama").value.trim();
  const category = document.getElementById("prodKategori").value;
  const cost = Number(document.getElementById("prodModal").value) || 0;
  const price = Number(document.getElementById("prodJual").value) || 0;
  const stock = Number(document.getElementById("prodStok").value) || 0;

  if (id) {
    const target = state.products.find((p) => p.id === id);
    if (target) Object.assign(target, { name, category, cost, price, stock });
  } else {
    state.products.push({
      id: "P-" + Date.now(),
      name,
      category,
      cost,
      price,
      stock,
    });
  }

  resetFormProduk();
  saveState();
  renderAll();
});

function resetFormProduk() {
  document.getElementById("formProduk").reset();
  document.getElementById("editProdukId").value = "";
  document.getElementById("btnSubmitProduk").textContent = "Simpan Produk";
}

document.getElementById("btnResetFormProduk").addEventListener("click", resetFormProduk);

window.editProduk = function (id) {
  const p = state.products.find((item) => item.id === id);
  if (!p) return;
  document.getElementById("editProdukId").value = p.id;
  document.getElementById("prodNama").value = p.name;
  document.getElementById("prodKategori").value = p.category;
  document.getElementById("prodModal").value = p.cost;
  document.getElementById("prodJual").value = p.price;
  document.getElementById("prodStok").value = p.stock;
  document.getElementById("btnSubmitProduk").textContent = "Update Produk";
};

window.quickRestock = function (id, qty) {
  const p = state.products.find((item) => item.id === id);
  if (!p) return;
  p.stock += qty;
  saveState();
  renderAll();
};

window.hapusProduk = function (id) {
  if (!confirm("Hapus produk ini?")) return;
  state.products = state.products.filter((p) => p.id !== id);
  saveState();
  renderAll();
};

/* 6. PEMBELIAN */
function renderPembelianPage() {
  const sel = document.getElementById("beliProdukId");
  sel.innerHTML = state.products.length
    ? state.products.map((p) => `<option value="${p.id}">${p.name} (Stok: ${p.stock})</option>`).join("")
    : `<option value="">-- Tambah produk dulu --</option>`;

  const el = document.getElementById("listPembelian");
  if (!state.purchases.length) {
    el.innerHTML = `<div class="empty-msg">Belum ada riwayat pembelian stok.</div>`;
    return;
  }

  el.innerHTML = state.purchases
    .map(
      (b) => `
      <div class="list-row">
        <div>
          <strong>${b.productName} (+${b.qty})</strong><br />
          <small class="p-meta">${b.date} • Supplier: ${b.supplier || "-"}</small>
        </div>
        <strong class="red-text">${rupiah(b.total)}</strong>
      </div>`
    )
    .join("");
}

document.getElementById("formPembelian").addEventListener("submit", (e) => {
  e.preventDefault();
  const prodId = document.getElementById("beliProdukId").value;
  const qty = Number(document.getElementById("beliQty").value) || 0;
  const total = Number(document.getElementById("beliTotal").value) || 0;
  const supplier = document.getElementById("beliSupplier").value.trim();

  const prod = state.products.find((p) => p.id === prodId);
  if (!prod || qty <= 0) {
    alert("Pilih produk yang valid.");
    return;
  }

  prod.stock += qty;
  if (total > 0) {
    prod.cost = Math.round(total / qty);
  }

  state.purchases.unshift({
    id: "BELI-" + Date.now(),
    productName: prod.name,
    qty,
    total,
    supplier,
    date: nowStr(),
  });

  state.cashflows.unshift({
    id: "KAS-" + Date.now(),
    type: "keluar",
    title: `Pembelian Stok: ${prod.name} (${qty}x)`,
    amount: total,
    date: nowStr(),
  });

  e.target.reset();
  saveState();
  renderAll();
  alert("Stok berhasil ditambahkan!");
});

/* 7. PENGELUARAN */
function renderPengeluaranPage() {
  const el = document.getElementById("listPengeluaran");
  if (!state.expenses.length) {
    el.innerHTML = `<div class="empty-msg">Belum ada catatan pengeluaran.</div>`;
    return;
  }

  el.innerHTML = state.expenses
    .map(
      (ex, idx) => `
      <div class="list-row">
        <div>
          <strong>${ex.name}</strong><br />
          <small class="p-meta">${ex.date} ${ex.note ? "• " + ex.note : ""}</small>
        </div>
        <div class="row-actions">
          <strong class="red-text">${rupiah(ex.amount)}</strong>
          <button class="mini-btn mini-del" onclick="hapusPengeluaran(${idx})">X</button>
        </div>
      </div>`
    )
    .join("");
}

document.getElementById("formPengeluaran").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("keluarNama").value.trim();
  const amount = Number(document.getElementById("keluarNominal").value) || 0;
  const note = document.getElementById("keluarCatatan").value.trim();

  if (!name || amount <= 0) return;

  state.expenses.unshift({
    id: "EXP-" + Date.now(),
    name,
    amount,
    note,
    date: nowStr(),
  });

  state.cashflows.unshift({
    id: "KAS-" + Date.now(),
    type: "keluar",
    title: "Pengeluaran: " + name,
    amount,
    date: nowStr(),
  });

  e.target.reset();
  saveState();
  renderAll();
});

window.hapusPengeluaran = function (idx) {
  state.expenses.splice(idx, 1);
  saveState();
  renderAll();
};

/* 8. ARUS KAS */
function calcSaldoKas() {
  let masuk = 0;
  let keluar = 0;
  state.cashflows.forEach((c) => {
    if (c.type === "masuk") masuk += Number(c.amount) || 0;
    else keluar += Number(c.amount) || 0;
  });
  return masuk - keluar;
}

function renderArusKasPage() {
  let masuk = 0;
  let keluar = 0;
  state.cashflows.forEach((c) => {
    if (c.type === "masuk") masuk += Number(c.amount) || 0;
    else keluar += Number(c.amount) || 0;
  });

  document.getElementById("kasMasukTotal").textContent = rupiah(masuk);
  document.getElementById("kasKeluarTotal").textContent = rupiah(keluar);
  document.getElementById("kasSaldoTotal").textContent = rupiah(masuk - keluar);

  const el = document.getElementById("listArusKas");
  if (!state.cashflows.length) {
    el.innerHTML = `<div class="empty-msg">Belum ada mutasi kas.</div>`;
    return;
  }

  el.innerHTML = state.cashflows
    .map(
      (c) => `
      <div class="list-row">
        <div>
          <strong>${c.title}</strong><br />
          <small class="p-meta">${c.date}</small>
        </div>
        <strong class="${c.type === "masuk" ? "green" : "red-text"}">
          ${c.type === "masuk" ? "+" : "-"} ${rupiah(c.amount)}
        </strong>
      </div>`
    )
    .join("");
}

/* 9. UTANG */
function renderUtangPage() {
  const el = document.getElementById("listUtang");
  if (!state.debts.length) {
    el.innerHTML = `<div class="empty-msg">Tidak ada catatan utang atau piutang.</div>`;
    return;
  }

  el.innerHTML = state.debts
    .map(
      (d, idx) => `
      <div class="list-row">
        <div>
          <strong>${d.name}</strong> <small class="p-meta">(${d.type})</small><br />
          <small class="p-meta">${d.date} • ${d.note || "-"}</small><br />
          <strong class="${d.paid ? "green" : "red-text"}">${rupiah(d.amount)} — ${d.paid ? "LUNAS" : "BELUM LUNAS"}</strong>
        </div>
        <div class="row-actions">
          ${!d.paid ? `<button class="mini-btn mini-ok" onclick="lunasiUtang(${idx})">Lunasi</button>` : ""}
          <button class="mini-btn mini-del" onclick="hapusUtang(${idx})">Hapus</button>
        </div>
      </div>`
    )
    .join("");
}

document.getElementById("formUtang").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = document.getElementById("utangJenis").value;
  const amount = Number(document.getElementById("utangNominal").value) || 0;
  const name = document.getElementById("utangNama").value.trim();
  const note = document.getElementById("utangCatatan").value.trim();

  if (!name || amount <= 0) return;

  state.debts.unshift({
    id: "UTG-" + Date.now(),
    type,
    name,
    amount,
    note,
    paid: false,
    date: nowStr(),
  });

  e.target.reset();
  saveState();
  renderAll();
});

window.lunasiUtang = function (idx) {
  const d = state.debts[idx];
  if (!d || d.paid) return;
  d.paid = true;
  state.cashflows.unshift({
    id: "KAS-" + Date.now(),
    type: d.type === "Piutang Pelanggan" ? "masuk" : "keluar",
    title: `Pelunasan ${d.type}: ${d.name}`,
    amount: d.amount,
    date: nowStr(),
  });
  saveState();
  renderAll();
};

window.hapusUtang = function (idx) {
  state.debts.splice(idx, 1);
  saveState();
  renderAll();
};

/* 10. MASTER */
function renderMasterPage() {
  const el = document.getElementById("listKategoriMaster");
  el.innerHTML = state.categories
    .map(
      (c, idx) => `
      <div class="list-row">
        <strong>${c}</strong>
        <button class="mini-btn mini-del" onclick="hapusKategori(${idx})">Hapus</button>
      </div>`
    )
    .join("");
}

document.getElementById("formKategori").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = document.getElementById("inputKategoriBaru").value.trim();
  if (!val) return;
  if (!state.categories.includes(val)) {
    state.categories.push(val);
    saveState();
    renderAll();
  }
  e.target.reset();
});

window.hapusKategori = function (idx) {
  if (state.categories.length <= 1) {
    alert("Minimal harus ada 1 kategori.");
    return;
  }
  state.categories.splice(idx, 1);
  saveState();
  renderAll();
};

/* 11. LAPORAN */
function renderLaporanPage() {
  let omzet = 0;
  let hpp = 0;
  const countMap = {};

  state.transactions.forEach((t) => {
    omzet += Number(t.total) || 0;
    hpp += Number(t.cost) || 0;
    (t.items || []).forEach((it) => {
      countMap[it.name] = (countMap[it.name] || 0) + (Number(it.qty) || 0);
    });
  });

  let pengeluaran = 0;
  state.expenses.forEach((ex) => {
    pengeluaran += Number(ex.amount) || 0;
  });

  const labaKotor = omzet - hpp;
  const labaBersih = labaKotor - pengeluaran;

  document.getElementById("lapOmzet").textContent = rupiah(omzet);
  document.getElementById("lapHpp").textContent = rupiah(hpp);
  document.getElementById("lapLabaKotor").textContent = rupiah(labaKotor);
  document.getElementById("lapPengeluaran").textContent = rupiah(pengeluaran);
  document.getElementById("lapLabaBersih").textContent = rupiah(labaBersih);

  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  const topEl = document.getElementById("lapProdukTerlaris");
  if (!sorted.length) {
    topEl.innerHTML = `<div class="empty-msg">Belum ada data penjualan produk.</div>`;
    return;
  }

  topEl.innerHTML = sorted
    .map(
      ([name, qty]) => `
      <div class="list-row">
        <strong>${name}</strong>
        <span>Terjual <b>${qty}</b> pcs</span>
      </div>`
    )
    .join("");
}

/* 12. PENGATURAN & BACKUP */
document.getElementById("formPengaturan").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings.owner = document.getElementById("setOwner").value.trim() || "Hendri S";
  state.settings.toko = document.getElementById("setToko").value.trim() || "Toko";
  saveState();
  renderAll();
  alert("Profil toko disimpan!");
});

document.getElementById("btnExportJson").addEventListener("click", () => {
  const json = JSON.stringify(state);
  const box = document.getElementById("backupBox");
  box.value = json;
  box.select();
  if (navigator.clipboard) navigator.clipboard.writeText(json).catch(() => {});
  alert("Data backup berhasil disalin ke kotak teks!");
});

document.getElementById("btnImportJson").addEventListener("click", () => {
  const raw = document.getElementById("backupBox").value.trim();
  if (!raw) {
    alert("Tempel data JSON backup dulu di kotak teks.");
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("Format salah");
    state = { ...structuredClone(DEFAULT_DATA), ...parsed };
    saveState();
    renderAll();
    alert("Data berhasil di-restore!");
  } catch (e) {
    alert("Format JSON tidak valid.");
  }
});

document.getElementById("btnResetSemua").addEventListener("click", () => {
  if (!confirm("Yakin ingin mereset semua data transaksi dan produk ke awal?")) return;
  state = structuredClone(DEFAULT_DATA);
  cart = [];
  saveState();
  renderAll();
  alert("Semua data berhasil direset.");
});

/* INIT */
renderAll();
/* FIX KHUSUS TOMBOL GARIS TIGA (☰) DI HEADER */
(function () {
  function bukaDrawerKasir() {
    var drawer =
      document.getElementById("sideDrawer") ||
      document.getElementById("drawer") ||
      document.querySelector("aside.drawer, aside");
    var overlay =
      document.getElementById("drawerOverlay") ||
      document.getElementById("overlay") ||
      document.querySelector(".drawer-overlay, .overlay");

    if (drawer) {
      drawer.classList.add("open");
      drawer.style.left = "0px";
      drawer.style.transform = "translateX(0)";
      drawer.style.visibility = "visible";
      drawer.style.display = "block";
      drawer.style.zIndex = "99999";
    }
    if (overlay) {
      overlay.classList.add("open");
      overlay.style.display = "block";
      overlay.style.opacity = "1";
      overlay.style.zIndex = "99990";
    }
  }

  function tutupDrawerKasir() {
    var drawer =
      document.getElementById("sideDrawer") ||
      document.getElementById("drawer") ||
      document.querySelector("aside.drawer, aside");
    var overlay =
      document.getElementById("drawerOverlay") ||
      document.getElementById("overlay") ||
      document.querySelector(".drawer-overlay, .overlay");

    if (drawer) {
      drawer.classList.remove("open");
      drawer.style.left = "-85%";
      drawer.style.transform = "";
    }
    if (overlay) {
      overlay.classList.remove("open");
      overlay.style.display = "none";
    }
  }

  function tangkapGarisTiga(e) {
    var el = e.target.closest("button, a, span, div");
    if (!el) return;
    var txt = (el.textContent || "").trim();
    var isDrawerBtn =
      el.id === "btnOpenDrawer" ||
      el.id === "btnMenu" ||
      txt === "☰" ||
      txt.indexOf("☰") !== -1;

    if (isDrawerBtn) {
      e.preventDefault();
      e.stopPropagation();
      bukaDrawerKasir();
    }
  }

  document.addEventListener("pointerdown", tangkapGarisTiga, true);
  document.addEventListener("click", tangkapGarisTiga, true);

  document.addEventListener("click", function (e) {
    var ov =
      document.getElementById("drawerOverlay") ||
      document.getElementById("overlay") ||
      document.querySelector(".drawer-overlay, .overlay");
    if (ov && e.target === ov) {
      tutupDrawerKasir();
    }
    var menuBtn = e.target.closest("#drawerMenu button, .drawer-menu button, .nav-btn, .menu-item");
    if (menuBtn) {
      setTimeout(tutupDrawerKasir, 80);
    }
  });
})();
