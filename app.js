(function () {
  'use strict';
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const formatINR = (n) => '₹ ' + Math.round(n).toLocaleString('en-IN');
  const todayString = () => new Date().toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const uid = () => 'TN-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random()*900+100);

  const toast = (msg) => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._tid); t._tid = setTimeout(()=>t.classList.remove('show'),2400);
  };

  const STORE = {
    user: JSON.parse(localStorage.getItem('tn_user') || 'null'),
    cart: JSON.parse(localStorage.getItem('tn_cart') || '[]'),
    saveUser(u){this.user=u; localStorage.setItem('tn_user',JSON.stringify(u));},
    clearUser(){this.user=null; localStorage.removeItem('tn_user');},
    saveCart(){localStorage.setItem('tn_cart',JSON.stringify(this.cart));}
  };

  function renderProducts() {
    const data = window.TN_PRODUCTS;
    Object.keys(data).forEach((cat) => {
      const grid = document.querySelector(`[data-grid="${cat}"]`);
      if (!grid) return;
      grid.innerHTML = data[cat].map((p) => `
        <article class="product">
          <div class="carousel" data-carousel>
            <div class="carousel-slides">
              ${p.images.map(src => `<img src="${src}" alt="${p.name}" loading="lazy" />`).join('')}
            </div>
            <div class="carousel-dots">
              ${p.images.map((_,i) => `<button class="carousel-dot ${i===0?'active':''}" data-slide="${i}" aria-label="Image ${i+1}"></button>`).join('')}
            </div>
          </div>
          <div class="product-body">
            <div class="product-name">${p.name}</div>
            <div class="product-meta">${p.meta}</div>
            <div class="product-price">${formatINR(p.basePrice)} <small>incl. making</small></div>
            <button class="buy-btn" data-buy="${p.id}" data-cat="${cat}"><i class="fa-solid fa-bag-shopping"></i> Buy Now</button>
          </div>
        </article>`).join('');
    });
    initCarousels();
    bindBuyButtons();
  }

  function initCarousels() {
    $$('[data-carousel]').forEach((car) => {
      const slides = $('.carousel-slides', car);
      const dots = $$('.carousel-dot', car);
      const total = dots.length;
      let idx = 0, timer;
      const go = (i) => {
        idx = (i + total) % total;
        slides.style.transform = `translateX(-${idx*100}%)`;
        dots.forEach((d,di)=>d.classList.toggle('active',di===idx));
      };
      dots.forEach((d) => d.addEventListener('click', () => { go(parseInt(d.dataset.slide,10)); restart(); }));
      const restart = () => { clearInterval(timer); timer = setInterval(()=>go(idx+1),4500); };
      restart();
    });
  }

  function findProduct(id) {
    const data = window.TN_PRODUCTS;
    for (const cat of Object.keys(data)) {
      const f = data[cat].find(p => p.id === id);
      if (f) return { ...f, category: cat };
    }
    return null;
  }

  function bindBuyButtons() {
    $$('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prod = findProduct(btn.dataset.buy);
        if (!prod) return;
        const existing = STORE.cart.find(c => c.id === prod.id);
        if (existing) existing.qty += 1;
        else STORE.cart.push({ id:prod.id, name:prod.name, meta:prod.meta, price:prod.basePrice, image:prod.images[0], category:prod.category, qty:1 });
        STORE.saveCart(); updateCartBadge();
        toast(`${prod.name} added to bag`);
      });
    });
  }

  function updateCartBadge() {
    $('#cartBadge').textContent = STORE.cart.reduce((s,x)=>s+x.qty,0);
  }

  function renderCart() {
    const body = $('#cartBody');
    if (!STORE.cart.length) { body.innerHTML = `<div class="empty">Your bag is empty.</div>`; $('#cartTotal').textContent = formatINR(0); return; }
    body.innerHTML = STORE.cart.map(it => `
      <div class="cart-item">
        <img src="${it.image}" alt="${it.name}" />
        <div>
          <div class="name">${it.name}</div>
          <div class="meta">${it.meta}</div>
          <div class="meta">Qty: ${it.qty}</div>
          <div class="price">${formatINR(it.price * it.qty)}</div>
        </div>
        <button class="remove" data-remove="${it.id}"><i class="fa-solid fa-trash"></i></button>
      </div>`).join('');
    $$('[data-remove]', body).forEach(b => b.addEventListener('click', () => {
      STORE.cart = STORE.cart.filter(c => c.id !== b.dataset.remove);
      STORE.saveCart(); renderCart(); updateCartBadge();
    }));
    $('#cartTotal').textContent = formatINR(STORE.cart.reduce((s,x)=>s+x.price*x.qty,0));
  }

  const openModal  = (id) => { const m=document.getElementById(id); m.classList.add('open'); m.setAttribute('aria-hidden','false'); };
  const closeModal = (id) => { const m=document.getElementById(id); m.classList.remove('open'); m.setAttribute('aria-hidden','true'); };
  const openDrawer = () => { renderCart(); $('#cartDrawer').classList.add('open'); };
  const closeDrawer = () => { $('#cartDrawer').classList.remove('open'); };

  function refreshLoginUI() { $('#loginLabel').textContent = STORE.user ? STORE.user.name.split(' ')[0] : 'Login'; }

  function bindLogin() {
    $('#loginBtn').addEventListener('click', () => {
      if (STORE.user) { if (confirm('Logout from TN?')) { STORE.clearUser(); refreshLoginUI(); toast('Logged out'); } }
      else openModal('loginModal');
    });
    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#liName').value.trim(), phone = $('#liPhone').value.trim(), email = $('#liEmail').value.trim();
      if (!name || !phone || !email) return;
      STORE.saveUser({ name, phone, email, joined:new Date().toISOString() });
      closeModal('loginModal'); refreshLoginUI();
      toast(`Welcome, ${name.split(' ')[0]}!`);
    });
  }

  function renderInvoice() {
    const items = STORE.cart;
    const subtotal = items.reduce((s,x)=>s+x.price*x.qty,0);
    const cgst = subtotal * 0.015, sgst = subtotal * 0.015, grand = subtotal + cgst + sgst;
    const invNo = uid();
    const user = STORE.user || { name:'Walk-in Guest', phone:'—', email:'—' };
    $('#invoiceSheet').innerHTML = `
      <div class="inv-head">
        <div class="inv-brand">
          <div class="mark">TN</div>
          <div>
            <h1 class="inv-title">TN JEWELLERY</h1>
            <div style="font-size:.85rem;color:#555;">Heritage · Purity · Trust</div>
            <div style="font-size:.78rem;color:#666;margin-top:4px;">GSTIN: 33ABCDE1234**** · BIS Lic: CM/L-7891***</div>
          </div>
        </div>
        <div class="inv-meta">
          <div>Tax Invoice</div>
          <div><strong>Invoice #:</strong> ${invNo}</div>
          <div><strong>Date:</strong> ${todayString()}</div>
        </div>
      </div>
      <div class="inv-section"><div class="inv-grid">
        <div class="box"><h4>Billed To</h4><div><strong>${user.name}</strong></div><div>${user.phone}</div><div>${user.email}</div></div>
        <div class="box"><h4>Sold From</h4><div><strong>TN JEWELLERY</strong></div><div>${document.getElementById('shopAddress').textContent}</div><div>${document.getElementById('shopPhone').textContent} · ${document.getElementById('shopEmail').textContent}</div></div>
      </div></div>
      <div class="inv-section"><h4>Items</h4>
        <table class="inv-table">
          <thead><tr><th>Image</th><th>Product</th><th>Details</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Amount</th></tr></thead>
          <tbody>${items.map(it=>`<tr><td><img src="${it.image}" alt="${it.name}" /></td><td><strong>${it.name}</strong><br/><span style="color:#777;font-size:.78rem;text-transform:uppercase;">${it.category}</span></td><td style="color:#555;font-size:.85rem;">${it.meta}</td><td class="right">${it.qty}</td><td class="right">${formatINR(it.price)}</td><td class="right"><strong>${formatINR(it.price*it.qty)}</strong></td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="inv-totals">
        <div class="row"><span>Subtotal</span><span>${formatINR(subtotal)}</span></div>
        <div class="row"><span>CGST (1.5%)</span><span>${formatINR(cgst)}</span></div>
        <div class="row"><span>SGST (1.5%)</span><span>${formatINR(sgst)}</span></div>
        <div class="row grand"><span>Grand Total</span><span>${formatINR(grand)}</span></div>
      </div>
      <div class="inv-thanks">Thank you for choosing TN JEWELLERY. May this purchase shine with prosperity.</div>
      <div class="inv-footer"><div>This is a computer-generated invoice. Signature not required.</div><div>Auth. Signatory · TN JEWELLERY</div></div>`;
  }

  function bindCheckout() {
    $('#cartBtn').addEventListener('click', openDrawer);
    $$('[data-close-drawer]').forEach(b => b.addEventListener('click', closeDrawer));
    $('#checkoutBtn').addEventListener('click', () => {
      if (!STORE.cart.length) { toast('Your bag is empty'); return; }
      if (!STORE.user) { toast('Please login to checkout'); closeDrawer(); openModal('loginModal'); return; }
      renderInvoice(); closeDrawer(); $('#invoiceOverlay').classList.add('open');
    });
    $('#closeInvoice').addEventListener('click', () => $('#invoiceOverlay').classList.remove('open'));
    $('#printInvoice').addEventListener('click', () => window.print());
  }

  const OZ_TO_G = 31.1035;
  async function fetchRates() {
    const ticker = $('#tickerTrack');
    try {
      const [gold, silver, plat, fx] = await Promise.allSettled([
        fetch('https://api.gold-api.com/price/XAU').then(r=>r.json()),
        fetch('https://api.gold-api.com/price/XAG').then(r=>r.json()),
        fetch('https://api.gold-api.com/price/XPT').then(r=>r.json()),
        fetch('https://open.er-api.com/v6/latest/USD').then(r=>r.json())
      ]);
      let usdInr = 83.2;
      if (fx.status === 'fulfilled' && fx.value?.rates?.INR) usdInr = fx.value.rates.INR;
      const item = (label, res, purity, factor=1) => {
        if (res.status !== 'fulfilled' || typeof res.value?.price !== 'number')
          return `<span><i class="fa-solid fa-circle-exclamation"></i> ${label}: <strong>—</strong></span>`;
        const inrG = (res.value.price * usdInr / OZ_TO_G) * factor;
        return `<span><i class="fa-solid fa-coins"></i> ${label} (${purity}): <strong>${formatINR(inrG)}/g</strong></span>`;
      };
      ticker.innerHTML = [
        item('Gold 24K', gold, '999', 1),
        item('Gold 22K', gold, '916', 0.916),
        item('Silver', silver, '999', 1),
        item('Platinum', plat, '950', 0.95),
        `<span><i class="fa-regular fa-clock"></i> Updated: <strong>${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</strong></span>`,
        `<span><i class="fa-solid fa-location-dot"></i> Chennai · India</span>`
      ].join('');
    } catch(e) {
      ticker.innerHTML = `<span><i class="fa-solid fa-circle-exclamation"></i> Live rates unavailable. Visit showroom for today's price.</span>`;
    }
  }

  function bindMisc() {
    $('#yr').textContent = new Date().getFullYear();
    $('#menuBtn').addEventListener('click', () => $('#primaryNav').classList.toggle('open'));
    $$('#primaryNav a').forEach(a => a.addEventListener('click', () => $('#primaryNav').classList.remove('open')));
    $$('[data-close]').forEach(b => b.addEventListener('click', (e) => {
      const m = e.target.closest('.modal');
      if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden','true'); }
    }));
    $$('.modal').forEach(m => m.addEventListener('click', (e) => {
      if (e.target === m) { m.classList.remove('open'); m.setAttribute('aria-hidden','true'); }
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal.open').forEach(m => { m.classList.remove('open'); m.setAttribute('aria-hidden','true'); });
        $('#cartDrawer').classList.remove('open');
        $('#invoiceOverlay').classList.remove('open');
      }
    });
  }

  function init() {
    renderProducts(); bindLogin(); bindCheckout(); bindMisc();
    updateCartBadge(); refreshLoginUI();
    fetchRates();
    setInterval(fetchRates, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();