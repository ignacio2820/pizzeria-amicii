    tailwind.config = {
      theme: {
        extend: {
          colors: {
            amicii: {
              black: "#000000",
              ink: "#0a0908",
              charcoal: "#141210",
              card: "#1c1c1c",
              gold: "#ff9d00",
              goldbright: "#ffd700",
              goldsoft: "#e8dcc4",
              cream: "#f4eee4",
              tomato: "#ff4d00",
              tomatodark: "#d93d00",
            },
          },
          fontFamily: {
            display: ['"Playfair Display"', "Georgia", "serif"],
            body: ['Poppins', "system-ui", "sans-serif"],
          },
          backgroundImage: {
            "stone-dark": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E\"), linear-gradient(180deg, #0a0a0a 0%25, #141210 50%25, #0a0a0a 100%25)",
          },
        },
      },
    };
(function () {
  "use strict";
  /** Carrito: sessionStorage (misma lógica que index.html) */
  const SESSION_CART_KEY = "amicii-cart";
  const LS_HORA = "amicii-reserva-hora";
  const LS_CHAT_SEEN = "amicii-chat-seen";
  /** Código de país + número sin + ni 0 (ej. Argentina: 54 + sin 0 del área) */
  const WHATSAPP_E164 = "5491112345678";
  // --- ESTADO GLOBAL ---
  const storeState = {
    isOpen: false,
    forceReservaWhatsapp: false,
    lastFomoMinuteVal: -1
  };

  const OPEN_HOUR = 19;
  const OPEN_MINUTE = 0;
  const CLOSE_HOUR = 23;
  const RESERVA_WHATSAPP_TAG = "[RESERVA FUERA DE HORARIO - ENTREGA PROGRAMADA 19:00 HS]";
  
  function updateStoreState() {
    const m = new Date();
    const mins = m.getHours() * 60 + m.getMinutes();
    storeState.isOpen = mins >= OPEN_HOUR * 60 + OPEN_MINUTE && mins < CLOSE_HOUR * 60;
  }

  // --- AUDIO ---
  const SFX = {
    add: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    remove: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_7f4f8f9f84.mp3?filename=paper-slide-101590.mp3",
  };
  let audioReady = false;
  const audioPool = {};

  function ensureAudioReady() {
    if (audioReady) return;
    Object.entries(SFX).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = key === "remove" ? 0.3 : 0.18;
      audioPool[key] = audio;
    });
    audioReady = true;
  }

  function primeAudio() {
    ensureAudioReady();
    Object.values(audioPool).forEach((audio) => {
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {});
      }
    });
  }

  function playSfx(name) {
    if (!audioReady || !audioPool[name]) return;
    const fx = new Audio(audioPool[name].src);
    fx.preload = "auto";
    fx.volume = audioPool[name].volume;
    fx.play().catch(() => {});
  }

  // --- UI ---
  function updateScheduleUI() {
    updateStoreState();
    const open = storeState.isOpen;
    const mobileStatus = document.getElementById("hours-status-mobile-text");
    if (mobileStatus) {
      mobileStatus.textContent = open ? "Abierto" : "Cerrado";
      mobileStatus.classList.toggle("status-open-neon", open);
      mobileStatus.classList.toggle("status-closed-red", !open);
    }
    const desktopSpan = document.querySelector("#hours-status-header-desktop span");
    if (desktopSpan) {
      desktopSpan.textContent = open
        ? "🟢 Abierto ahora (hasta 23:00 hs)"
        : "🔴 Cerrado (Lun-Dom 19:00 a 23:00 hs)";
      desktopSpan.classList.toggle("status-open-neon", open);
      desktopSpan.classList.toggle("status-closed-red", !open);
    }
    const fSpan = document.querySelector("#hours-status-footer span");
    if (fSpan) {
      fSpan.textContent = open
        ? "🟢 Abierto ahora (hasta 23:00 hs)"
        : "🔴 Cerrado (Lun-Dom 19:00 a 23:00 hs)";
      fSpan.classList.toggle("status-open-neon", open);
      fSpan.classList.toggle("status-closed-red", !open);
    }
    const btnWa = document.getElementById("btn-whatsapp");
    if (btnWa) {
      const waText = btnWa.querySelector("#btn-whatsapp-text");
      const waLabel = open
        ? (btnWa.getAttribute("data-label-open") || "Finalizar pedido por WhatsApp")
        : (btnWa.getAttribute("data-label-closed") || "Reservar para las 19:00 hs");
      if (waText) waText.textContent = waLabel;
    }
    const notice = document.getElementById("checkout-reserva-notice");
    if (notice) notice.classList.toggle("hidden", open);
    const proceed = document.getElementById("btn-proceed-checkout");
    if (proceed) {
      proceed.textContent = open
        ? (proceed.getAttribute("data-label-open") || "IR A LA RESERVA")
        : (proceed.getAttribute("data-label-closed") || "Completar reserva");
    }
    const primaryCta = document.getElementById("btn-primary-cta");
    if (primaryCta) {
      primaryCta.textContent = open ? "Pedir ahora" : "Hacer Reserva";
    }
  }

  function updateFomoBanner() {
    const bar = document.getElementById("fomo-banner");
    const fomoMins = document.getElementById("fomo-mins");
    const fomoPlural = document.getElementById("fomo-plural");
    if (!bar || !fomoMins || !fomoPlural) return;
    
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const isFomoWindow = mins >= 18 * 60 && mins < 19 * 60;

    if (!isFomoWindow) {
      bar.classList.add("hidden");
      storeState.lastFomoMinuteVal = -1;
      return;
    }
    const openT = new Date(now);
    openT.setHours(19, 0, 0, 0);
    const diff = openT - now;
    if (diff <= 0) {
      bar.classList.add("hidden");
      return;
    }
    const minutes = Math.max(1, Math.ceil(diff / 60000));
    if (storeState.lastFomoMinuteVal !== minutes) {
      fomoMins.classList.add("fomo-tick");
      fomoPlural.classList.add("fomo-tick");
      setTimeout(() => {
        fomoMins.classList.remove("fomo-tick");
        fomoPlural.classList.remove("fomo-tick");
      }, 300);
      storeState.lastFomoMinuteVal = minutes;
    }
    fomoMins.textContent = String(minutes);
    fomoPlural.textContent = minutes === 1 ? " minuto" : " minutos";
    bar.classList.remove("hidden");
  }

  function updateReservaBlock() {
    const block = document.getElementById("cart-reserva-block");
    if (!block) return;
    const show = cart.length > 0 && !storeState.isOpen;
    block.classList.toggle("hidden", !show);
    const sel = document.getElementById("cart-reserva-hora");
    if (sel) {
      sel.setAttribute("aria-required", show ? "true" : "false");
    }
  }

  function clearHoraReserva() {
    const s = document.getElementById("cart-reserva-hora");
    if (s) {
      s.value = "";
      s.selectedIndex = 0;
    }
    try {
      localStorage.removeItem(LS_HORA);
    } catch (e) {}
  }

  const PRODUCTS = [
    {
      id: "pz-muzza",
      category: "pizza",
      name: "Muzzarella",
      desc: "Clásica de siempre: salsa, abundante muzza fundida y orégano.",
      price: 7500,
      image: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=800&q=80",
    },
    {
      id: "pz-dmuzza",
      category: "pizza",
      name: "Doble Muzzarella",
      desc: "Doble capa de queso cremoso, dorado al horno de piedra.",
      price: 8900,
      image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80",
    },
    {
      id: "pz-fugazz",
      category: "pizza",
      name: "Fugazzeta",
      desc: "Cebolla dulce salteada y muzzarella generosa, tradición argentina.",
      price: 9200,
      image: "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=800&q=80",
    },
    {
      id: "pz-cala",
      category: "pizza",
      name: "Calabresa",
      desc: "Fetas de longaniza calabresa, morrones asados y queso a punto.",
      price: 9600,
      image: "https://images.unsplash.com/photo-1528137871618-79d2761e3fd5?w=800&q=80",
    },
    {
      id: "pz-espec",
      category: "pizza",
      name: "Especial",
      desc: "Jamoncito, morrones, huevo a la plancheta y sabor a festejo.",
      price: 10200,
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    },
    {
      id: "cl-trad",
      category: "calzone",
      name: "Calzone Tradicional (Napolitano)",
      desc: "Ricotta, tomate y albahaca; masa cerrada, dorada y húmeda por dentro.",
      price: 8500,
      image: "assets/calzonenapolitano.jpeg",
    },
    {
      id: "cl-esp",
      category: "calzone",
      name: "Calzone Especial",
      desc: "Relleno con jamón, queso, morrones: versión contundente AMICII.",
      price: 9500,
      image: "assets/calzoneespecial.jpeg",
    },
  ];

  function getProductById(id) {
    return PRODUCTS.find((p) => p.id === id);
  }

  function loadCart() {
    try {
      const raw = sessionStorage.getItem(SESSION_CART_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    try {
      sessionStorage.setItem(SESSION_CART_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  let cart = loadCart();

  function countPizzas() {
    return cart.reduce((acc, line) => {
      const p = getProductById(line.id);
      if (p && p.category === "pizza") return acc + line.qty;
      return acc;
    }, 0);
  }

  function getCalzoneCount() {
    return cart.reduce((acc, line) => {
      const p = getProductById(line.id);
      if (p && p.category === "calzone") return acc + line.qty;
      return acc;
    }, 0);
  }

  function computeTotals() {
    let sub = 0;
    let calzoneOriginal = 0;
    for (const line of cart) {
      const p = getProductById(line.id);
      if (!p) continue;
      const lineSub = p.price * line.qty;
      sub += lineSub;
      if (p.category === "calzone") {
        calzoneOriginal += p.price * line.qty;
      }
    }
    const promoActive = countPizzas() >= 2 && getCalzoneCount() > 0;
    let calzoneDiscount = 0;
    if (promoActive) {
      for (const line of cart) {
        const p = getProductById(line.id);
        if (p && p.category === "calzone") {
          calzoneDiscount += p.price * line.qty * 0.2;
        }
      }
    }
    const total = Math.max(0, sub - calzoneDiscount);
    return { sub, calzoneDiscount, total, promoActive };
  }

  function formatMoney(n) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  }

  function updateBadges() {
    const n = cart.reduce((a, l) => a + l.qty, 0);
    const floatBadge = document.getElementById("float-cart-badge");
    if (floatBadge) {
      floatBadge.textContent = String(n);
      floatBadge.classList.toggle("hidden", n === 0);
      if (n > 0) floatBadge.classList.remove("scale-0");
    }
    const headerBadge = document.getElementById("header-cart-badge");
    if (headerBadge) {
      headerBadge.textContent = String(n);
      headerBadge.classList.toggle("hidden", n === 0);
    }
  }

  function renderProductCard(p) {
    const isPizza = p.category === "pizza";
    const cardClass = isPizza
      ? "pizza-card group flex flex-col overflow-hidden rounded-2xl border border-amicii-gold/30 bg-[#1c1c1c] shadow-lg shadow-black/35 ring-1 ring-inset ring-amicii-gold/15 transition hover:border-amicii-goldbright/60 hover:shadow-amicii-tomato/20"
      : "group flex flex-col overflow-hidden rounded-2xl border border-amicii-gold/30 bg-[#1c1c1c] shadow-lg shadow-black/35 ring-1 ring-inset ring-amicii-gold/15 transition hover:border-amicii-goldbright/60 hover:shadow-amicii-tomato/20";
    const imgClass = "pizza-card-image h-full w-full object-cover";
    const showSteam = p.category === "calzone" || p.id === "pz-espec";
    return `
      <article class="${cardClass}">
        <div class="relative aspect-[4/3] overflow-hidden">
          ${showSteam ? '<div class="steam-wrap" aria-hidden="true"><span class="steam-line"></span><span class="steam-line"></span><span class="steam-line"></span></div>' : ""}
          <img src="${p.image}" alt="${p.name}" class="${imgClass}" loading="lazy" width="800" height="600" />
          <div class="absolute inset-0 bg-gradient-to-t from-amicii-black/85 to-transparent" aria-hidden="true"></div>
        </div>
        <div class="flex flex-1 flex-col p-5">
          <h4 class="font-display text-lg font-bold text-amicii-goldsoft">${p.name}</h4>
          <p class="mt-2 flex-1 text-sm font-medium leading-relaxed text-amicii-cream">${p.desc}</p>
          <div class="mt-4 flex items-end justify-between gap-3">
            <span class="text-lg font-bold text-amicii-goldbright drop-shadow-[0_0_8px_rgba(255,215,0,0.65)]">${formatMoney(p.price)}</span>
            <button
              type="button"
              class="add-to-cart btn-amicii-primary inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-[0_0_10px_rgba(255,77,0,0.4)]"
              data-id="${p.id}"
            >Agregar</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderGrids() {
    const pz = PRODUCTS.filter((p) => p.category === "pizza");
    const cz = PRODUCTS.filter((p) => p.category === "calzone");
    document.getElementById("grid-pizzas").innerHTML = pz.map(renderProductCard).join("");
    document.getElementById("grid-calzones").innerHTML = cz.map(renderProductCard).join("");
  }

  function addToCart(id) {
    const line = cart.find((l) => l.id === id);
    if (line) line.qty += 1;
    else cart.push({ id, qty: 1 });
    saveCart(cart);
    playSfx("add");
    updateBadges();
    renderCart();
    // Removing auto-chat on add to cart
    // if (!storeState.isOpen) {
    //   showChat();
    //   appendBotTypingMessage("Excelente elección 👨‍🍳🍕 Lo anoto para tu reserva. ¡Mañana va a estar increíble! ✨", 720);
    // }
    maybeTriggerPromoHint();
  }

  function showAddedFeedback(btn) {
    if (!btn) return;
    if (btn.dataset.feedbackActive === "1") return;
    btn.dataset.feedbackActive = "1";
    const original = btn.textContent;
    btn.textContent = "¡Agregado!";
    btn.classList.add("brightness-110", "scale-[1.03]");
    setTimeout(() => {
      btn.textContent = original || "Agregar";
      btn.classList.remove("brightness-110", "scale-[1.03]");
      delete btn.dataset.feedbackActive;
    }, 700);
  }

  function setQty(id, delta) {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    const newQty = line.qty + delta;
    if (newQty < 0) return;
    if (newQty === 0) {
      const row = document.querySelector(`[data-cart-line-id="${id}"]`);
      const doRemove = () => {
        cart = cart.filter((l) => l.id !== id);
        saveCart(cart);
        playSfx("remove");
        updateBadges();
        renderCart();
        maybeTriggerPromoHint();
      };
      if (row) {
        row.classList.add("cart-line--leaving");
        setTimeout(doRemove, 280);
      } else {
        doRemove();
      }
      return;
    }
    line.qty = newQty;
    saveCart(cart);
    updateBadges();
    renderCart();
    maybeTriggerPromoHint();
  }

  function removeLine(id) {
    cart = cart.filter((l) => l.id !== id);
    saveCart(cart);
    playSfx("remove");
    updateBadges();
    renderCart();
    maybeTriggerPromoHint();
  }

  function emptyCart() {
    if (!cart.length) return;
    if (confirm("¿Vaciar todo el carrito?")) {
      cart = [];
      saveCart(cart);
      playSfx("remove");
      clearHoraReserva();
      updateBadges();
      renderCart();
      maybeTriggerPromoHint();
    }
  }

  function renderCart() {
    const listEl = document.getElementById("cart-list");
    const emptyEl = document.getElementById("cart-empty");
    const footEl = document.getElementById("cart-footer");
    const t = computeTotals();
    if (!cart.length) {
      emptyEl.classList.remove("hidden");
      listEl.classList.add("hidden");
      footEl.classList.add("hidden");
      clearHoraReserva();
      updateReservaBlock();
      return;
    }
    emptyEl.classList.add("hidden");
    listEl.classList.remove("hidden");
    footEl.classList.remove("hidden");
    const promo = document.getElementById("promo-line");
    if (t.promoActive) {
      promo.classList.remove("hidden");
      promo.textContent = "Promo activa: 2+ pizzas en el carrito — 20% de descuento en calzones.";
    } else {
      promo.classList.add("hidden");
    }
    document.getElementById("cart-subtotal").textContent = formatMoney(t.sub);
    const disc = document.getElementById("discount-line");
    if (t.calzoneDiscount > 0) {
      disc.classList.remove("hidden");
      document.getElementById("cart-discount").textContent = "−" + formatMoney(t.calzoneDiscount);
    } else {
      disc.classList.add("hidden");
    }
    document.getElementById("cart-total").textContent = formatMoney(t.total);
    listEl.innerHTML = cart
      .map((line) => {
        const p = getProductById(line.id);
        if (!p) return "";
        let unitNote = "";
        if (p.category === "calzone" && t.promoActive) {
          unitNote = ' <span class="text-xs text-green-300/80">(−20% promo)</span>';
        }
        return `
          <div class="cart-line mb-3 flex gap-3 rounded-xl border border-amicii-gold/25 bg-amicii-card/90 p-3 shadow-inner shadow-black/20" data-cart-line-id="${p.id}" data-line="${p.id}">
            <img src="${p.image}" alt="" class="h-16 w-20 flex-shrink-0 rounded-lg object-cover" width="80" height="64" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-amicii-cream line-clamp-2">${p.name}</p>
              <p class="text-xs font-medium text-amicii-cream/75">${formatMoney(p.price)} c/u${unitNote}</p>
              <div class="mt-2 flex items-center gap-2">
                <button type="button" class="cart-minus h-8 w-8 flex-shrink-0 rounded-lg border border-amicii-gold/35 text-amicii-cream transition hover:border-amicii-tomato/50 hover:bg-amicii-tomato/15" data-id="${p.id}" aria-label="Quitar una unidad">−</button>
                <span class="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-amicii-goldbright">${line.qty}</span>
                <button type="button" class="cart-plus h-8 w-8 flex-shrink-0 rounded-lg border border-amicii-gold/35 text-amicii-cream transition hover:border-amicii-tomato/50 hover:bg-amicii-tomato/15" data-id="${p.id}" aria-label="Agregar una unidad">+</button>
                <button type="button" class="cart-remove ml-auto text-xs font-semibold text-amicii-tomato/90 underline transition hover:text-amicii-goldbright" data-id="${p.id}">Quitar todo</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
    updateReservaBlock();
  }

  function openCart() {
    const panel = document.getElementById("cart-panel");
    const overlay = document.getElementById("cart-overlay");
    overlay.classList.remove("hidden");
    // trigger reflow
    void overlay.offsetWidth;
    overlay.classList.remove("opacity-0");
    panel.classList.remove("translate-x-full");
    document.body.style.overflow = "hidden";
    updateScheduleUI();
    updateReservaBlock();
    updateFomoBanner();
  }

  function closeCart() {
    const panel = document.getElementById("cart-panel");
    const overlay = document.getElementById("cart-overlay");
    panel.classList.add("translate-x-full");
    overlay.classList.add("opacity-0");
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 300);
    document.body.style.overflow = "";
  }

  function openCheckout() {
    if (!cart.length) {
      alert("Agregá productos al carrito.");
      return;
    }
    if (!storeState.isOpen) {
      const selH = document.getElementById("cart-reserva-hora");
      if (!selH || !selH.value) {
        alert("Antes de continuar, elegí a qué hora querés recibir o retirar tu reserva (selector en el carrito).");
        return;
      }
    }
    closeCart();
    document.getElementById("checkout-form").reset();
    document.getElementById("field-direccion").classList.add("hidden");
    
    const m = document.getElementById("checkout-modal");
    const mc = document.getElementById("checkout-modal-content");
    m.classList.remove("hidden");
    m.classList.add("flex");
    void m.offsetWidth;
    m.classList.remove("opacity-0");
    mc.classList.remove("scale-95");
    mc.classList.add("scale-100");
    updateScheduleUI();
  }

  function closeCheckout() {
    const m = document.getElementById("checkout-modal");
    const mc = document.getElementById("checkout-modal-content");
    m.classList.add("opacity-0");
    mc.classList.remove("scale-100");
    mc.classList.add("scale-95");
    setTimeout(() => {
      m.classList.add("hidden");
      m.classList.remove("flex");
    }, 300);
  }

  function getCheckoutData() {
    const form = document.getElementById("checkout-form");
    const clientName = (form.clientName && form.clientName.value) ? form.clientName.value.trim() : "";
    const clientPhone =
      form.clientPhone && form.clientPhone.value ? form.clientPhone.value.trim() : "";
    const entrega = form.querySelector('input[name="entrega"]:checked')?.value || "";
    const pago = form.querySelector('input[name="pago"]:checked')?.value || "";
    const cupon = (form.cupon && form.cupon.value) ? form.cupon.value.trim() : "";
    const direccion = form.direccion && form.direccion.value ? form.direccion.value.trim() : "";
    if (!clientName) {
      alert("Escribí tu nombre completo para continuar.");
      return null;
    }
    if (!clientPhone) {
      alert("Ingresá tu teléfono para coordinar el pedido.");
      return null;
    }
    if (!entrega) {
      alert("Elegí un método de entrega.");
      return null;
    }
    if (entrega === "domicilio" && !direccion) {
      alert("Para envío a domicilio, ingresá la dirección completa.");
      return null;
    }
    if (!pago) {
      alert("Elegí un método de pago.");
      return null;
    }
    const selH = document.getElementById("cart-reserva-hora");
    let horaReserva = "";
    if (!storeState.isOpen) {
      if (!selH || !selH.value) {
        alert("Elegí la hora aproximada de retiro o entrega en el carrito (obligatorio para reservas).");
        return null;
      }
      horaReserva = selH.value;
    } else if (storeState.forceReservaWhatsapp && selH && selH.value) {
      horaReserva = selH.value;
    }
    return {
      clientName,
      clientPhone,
      entrega,
      pago,
      cupon,
      direccion: entrega === "domicilio" ? direccion : "",
      horaReserva,
    };
  }

  function formatPagoLabelWhatsapp(code) {
    if (code === "efectivo") return "Efectivo (en local / delivery)";
    if (code === "mercadopago") return "Mercado Pago (QR / link)";
    if (code === "transferencia") return "Transferencia bancaria";
    return code ? String(code) : "(no indicado)";
  }

  function buildWhatsappText(checkout) {
    const t = computeTotals();
    const lines = [];
    lines.push(`Hola, soy ${checkout.clientName}. Quiero realizar el siguiente pedido.`);
    lines.push(`*Teléfono / contacto:* ${checkout.clientPhone || ""}`);
    lines.push("");
    if (storeState.forceReservaWhatsapp || !storeState.isOpen) {
      lines.push("*" + RESERVA_WHATSAPP_TAG + "*");
      lines.push("");
    }
    lines.push("*PEDIDO AMICII*");
    lines.push("");
    lines.push("*Productos:*");
    for (const line of cart) {
      const p = getProductById(line.id);
      if (!p) continue;
      lines.push(`• ${p.name} x${line.qty} — ${formatMoney(p.price * line.qty)}`);
    }
    lines.push("");
    if (checkout.horaReserva) {
      lines.push("⏰ HORA SOLICITADA: " + checkout.horaReserva);
      lines.push("");
    }
    lines.push(`*Subtotal:* ${formatMoney(t.sub)}`);
    if (t.calzoneDiscount > 0) {
      lines.push(`*Desc. calzones (2+ pizzas):* −${formatMoney(t.calzoneDiscount)}`);
    }
    lines.push(`*Total:* ${formatMoney(t.total)}`);
    lines.push("");
    lines.push("*Entrega:* " + (checkout.entrega === "domicilio" ? "Envío a domicilio" : "Retiro en local"));
    if (checkout.entrega === "domicilio") {
      lines.push(`*Dirección:* ${checkout.direccion}`);
    }
    lines.push("*Método de pago elegido:* " + formatPagoLabelWhatsapp(checkout.pago));
    lines.push("*Cupón:* " + (checkout.cupon || "(ninguno)"));
    return lines.join("\n");
  }

  function openReservationConfirm() {
    const m = document.getElementById("reservation-confirm-modal");
    const mc = document.getElementById("reservation-modal-content");
    m.classList.remove("hidden");
    m.classList.add("flex");
    void m.offsetWidth;
    m.classList.remove("opacity-0");
    mc.classList.remove("scale-95");
    mc.classList.add("scale-100");
  }

  function closeReservationConfirm() {
    const m = document.getElementById("reservation-confirm-modal");
    const mc = document.getElementById("reservation-modal-content");
    m.classList.add("opacity-0");
    mc.classList.remove("scale-100");
    mc.classList.add("scale-95");
    setTimeout(() => {
      m.classList.add("hidden");
      m.classList.remove("flex");
      storeState.forceReservaWhatsapp = false;
    }, 300);
  }

  async function doSendWhatsapp() {
    const c = getCheckoutData();
    if (!c) return;
    const waBtnSpinner = document.getElementById("btn-whatsapp-spinner");
    const reservaBtnSpinner = document.getElementById("btn-reservation-whatsapp-spinner");
    waBtnSpinner?.classList.remove("hidden");
    reservaBtnSpinner?.classList.remove("hidden");
    await new Promise((resolve) => setTimeout(resolve, 260));
    const text = encodeURIComponent(buildWhatsappText(c));
    const url = `https://wa.me/${WHATSAPP_E164}?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
    waBtnSpinner?.classList.add("hidden");
    reservaBtnSpinner?.classList.add("hidden");
    closeReservationConfirm();
    closeCheckout();
    const f = document.getElementById("checkout-form");
    f.reset();
    document.getElementById("field-direccion").classList.add("hidden");
    document.getElementById("direccion").removeAttribute("required");
    clearHoraReserva();
  }

  function sendWhatsapp() {
    const c = getCheckoutData();
    if (!c) return;
    if (!storeState.isOpen) {
      storeState.forceReservaWhatsapp = true;
      openReservationConfirm();
      return;
    }
    void doSendWhatsapp();
  }

  document.getElementById("grid-pizzas").addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart");
    if (btn && btn.dataset.id) {
      addToCart(btn.dataset.id);
      showAddedFeedback(btn);
    }
  });
  document.getElementById("grid-calzones").addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart");
    if (btn && btn.dataset.id) {
      addToCart(btn.dataset.id);
      showAddedFeedback(btn);
    }
  });

  document.getElementById("cart-list").addEventListener("click", (e) => {
    const minus = e.target.closest(".cart-minus");
    const plus = e.target.closest(".cart-plus");
    const del = e.target.closest(".cart-remove");
    if (minus) setQty(minus.dataset.id, -1);
    if (plus) setQty(plus.dataset.id, 1);
    if (del) removeLine(del.dataset.id);
  });

  document.getElementById("btn-floating-cart")?.addEventListener("click", openCart);
  document.getElementById("btn-header-cart")?.addEventListener("click", openCart);
  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    document.addEventListener(evt, primeAudio, { once: true, passive: true });
  });

  const mobileNavPanel = document.getElementById("mobile-nav-panel");
  const mobileNavBackdrop = document.getElementById("mobile-nav-backdrop");
  const btnMobileMenu = document.getElementById("btn-mobile-menu");
  const btnCloseMobileNav = document.getElementById("btn-close-mobile-nav");

  function openMobileNav() {
    if (!mobileNavPanel || !mobileNavBackdrop || !btnMobileMenu) return;
    mobileNavPanel.classList.remove("translate-x-full");
    mobileNavBackdrop.classList.remove("hidden");
    mobileNavPanel.setAttribute("aria-hidden", "false");
    btnMobileMenu.setAttribute("aria-expanded", "true");
    document.body.classList.add("overflow-hidden");
  }

  function closeMobileNav() {
    if (!mobileNavPanel || !mobileNavBackdrop || !btnMobileMenu) return;
    mobileNavPanel.classList.add("translate-x-full");
    mobileNavBackdrop.classList.add("hidden");
    mobileNavPanel.setAttribute("aria-hidden", "true");
    btnMobileMenu.setAttribute("aria-expanded", "false");
    document.body.classList.remove("overflow-hidden");
  }

  btnMobileMenu?.addEventListener("click", () => openMobileNav());
  btnCloseMobileNav?.addEventListener("click", () => closeMobileNav());
  mobileNavBackdrop?.addEventListener("click", () => closeMobileNav());
  document.querySelectorAll(".mobile-nav-link").forEach((a) => {
    a.addEventListener("click", () => closeMobileNav());
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileNavPanel && !mobileNavPanel.classList.contains("translate-x-full")) {
      closeMobileNav();
    }
  });

  const siteHeader = document.getElementById("site-header");
  function syncHeaderScroll() {
    if (!siteHeader) return;
    siteHeader.classList.toggle("header-scrolled", window.scrollY > 32);
  }
  window.addEventListener("scroll", syncHeaderScroll, { passive: true });
  syncHeaderScroll();
  document.getElementById("btn-close-cart").addEventListener("click", closeCart);
  document.getElementById("btn-continue-shopping").addEventListener("click", closeCart);
  document.getElementById("cart-overlay").addEventListener("click", closeCart);
  document.getElementById("btn-empty-cart").addEventListener("click", emptyCart);
  document.getElementById("btn-proceed-checkout").addEventListener("click", openCheckout);

  document.querySelectorAll('input[name="entrega"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const wrap = document.getElementById("field-direccion");
      const field = document.getElementById("direccion");
      if (e.target.value === "domicilio") {
        wrap.classList.remove("hidden");
        field.setAttribute("required", "required");
      } else {
        wrap.classList.add("hidden");
        field.removeAttribute("required");
        field.value = "";
      }
    });
  });

  document.getElementById("btn-checkout-cancel").addEventListener("click", () => {
    closeCheckout();
    openCart();
  });
  document.getElementById("checkout-backdrop").addEventListener("click", () => {
    closeCheckout();
    openCart();
  });
  document.getElementById("btn-whatsapp").addEventListener("click", (e) => {
    e.preventDefault();
    sendWhatsapp();
  });
  document.getElementById("btn-reservation-confirm-whatsapp").addEventListener("click", (e) => {
    e.preventDefault();
    void doSendWhatsapp();
  });
  document.getElementById("btn-reservation-cancel").addEventListener("click", (e) => {
    e.preventDefault();
    closeReservationConfirm();
  });
  document.getElementById("reservation-confirm-backdrop").addEventListener("click", closeReservationConfirm);

  const chatOpen = { value: false };
  let companionTimer = null;
  let lastCompanionIdx = -1;
  let promoHintShown = false;
  const COMPANION_LINES = [
    "¿Sentís ese aroma? 🍕 Es nuestra masa madre madurando... un secreto de familia 🇮🇹.",
    "Dato de maestro 👨‍🍳: nuestros calzones salen bien doraditos, ¡ideales para compartir! ✨",
  ];
  const WELCOME_OPEN =
    "¡Hola! Soy el Maestro de AMICII. ¿Hoy sale una pizza clásica o te tienta probar uno de nuestros calzones artesanales?";
  const WELCOME_OPEN_ALT =
    "¿Buscás algo suave para compartir o una explosión de sabor con mucho pepperoni?";
  const WELCOME_RETURNING =
    "¡Qué bueno verte de nuevo! ¿Te quedaste con ganas de otra porción o probamos algo distinto hoy?";
  const WELCOME_CLOSED =
    "¡Buenas! 🌙 En este momento nuestros hornos están descansando para volver con todo, pero no te quedes con las ganas. Podes dejar tu reserva ahora y te damos prioridad apenas salga la primera pizza del horno. ¡Nada como dormir sabiendo que la cena ya está resuelta! Te esperamos de Lunes a Domingo, de 19:00 a 23:00 hs. ✨";
  const TIP = "Toque de la casa: con 2 pizzas, tus calzones llevan 20% de descuento.";

  function appendChatMessage(text, fromBot) {
    const el = document.getElementById("chat-messages");
    const row = document.createElement("div");
    row.className = fromBot
      ? "font-body rounded-xl rounded-bl-sm border border-amicii-gold/30 bg-amicii-card/90 px-3 py-2 text-left font-medium text-amicii-cream shadow-sm"
      : "font-body ml-8 rounded-xl rounded-br-sm border border-amicii-gold/20 bg-amicii-black/60 px-3 py-2 text-left font-medium text-amicii-cream";
    row.textContent = text;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  }

  function appendBotTypingMessage(text, delayMs = 1500) {
    const el = document.getElementById("chat-messages");
    const typing = document.createElement("div");
    typing.className =
      "chat-bubble-typing rounded-xl rounded-bl-sm border border-amicii-gold/25 bg-amicii-card/70 px-3 py-2 text-left font-medium text-amicii-cream/85";
    typing.textContent = "Maestro amasando";
    el.appendChild(typing);
    el.scrollTop = el.scrollHeight;
    const typingDelay = Math.max(1500, delayMs || 0);
    setTimeout(() => {
      typing.remove();
      appendChatMessage(text, true);
    }, typingDelay);
  }

  function scheduleNextCompanionMessage() {
    if (!chatOpen.value || document.getElementById("chat-panel").classList.contains("hidden")) return;
    const delay = 30000 + Math.floor(Math.random() * 10001); // 30-40s
    companionTimer = setTimeout(() => {
      if (!chatOpen.value || document.getElementById("chat-panel").classList.contains("hidden")) return;
      let idx = Math.floor(Math.random() * COMPANION_LINES.length);
      if (COMPANION_LINES.length > 1 && idx === lastCompanionIdx) {
        idx = (idx + 1) % COMPANION_LINES.length;
      }
      lastCompanionIdx = idx;
      appendBotTypingMessage(COMPANION_LINES[idx], 1500);
      scheduleNextCompanionMessage();
    }, delay);
  }

  function startCompanionMessages() {
    if (companionTimer) return;
    scheduleNextCompanionMessage();
  }

  function stopCompanionMessages() {
    if (!companionTimer) return;
    clearTimeout(companionTimer);
    companionTimer = null;
  }

  function maybeTriggerPromoHint() {
    const hasPromoThreshold = countPizzas() >= 2;
    if (!hasPromoThreshold) {
      promoHintShown = false;
      return;
    }
    if (promoHintShown) return;
    promoHintShown = true;
    
    // Only show promo text if chat is already open, do not force open
    if (chatOpen.value && !document.getElementById("chat-panel").classList.contains("hidden")) {
      appendBotTypingMessage("¡Toque de la casa! 👨‍🍳 Veo que llevás 2 pizzas... ¡aprovechá que hoy tus calzones tienen un 20% de descuento! 🇮🇹", 1500);
    }
  }

  function chefReplyByIntent(userText) {
    const txt = (userText || "").toLowerCase();
    if (/picante|pepperoni|fuerte|intenso/.test(txt)) {
      return "Si querés picante, andá por la Pizza Pepperoni: sale del horno con un toque de aceite de oliva que levanta todo el sabor.";
    }
    if (/contundente|abundante|llenador|hambre|potente/.test(txt)) {
      return "Para algo contundente, los calzones artesanales son tu jugada: masa artesanal, relleno generoso y toque de la casa.";
    }
    return "Si es tu primera vez en AMICII, la Doble Muzzarella nunca falla, ¡es la reina de la casa!";
  }

  function appendSmartChatActions() {
    const el = document.getElementById("chat-messages");
    if (el.querySelector("[data-smart-actions]")) return;
    const row = document.createElement("div");
    row.setAttribute("data-smart-actions", "1");
    row.className = "mt-2 flex flex-wrap gap-2";
    const mkBtn = (label, isPrimary) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = isPrimary
        ? "btn-amicii-primary rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
        : "btn-amicii-outline rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide";
      b.textContent = label;
      return b;
    };
    const spicy = mkBtn("Quiero algo picante", true);
    spicy.addEventListener("click", () => {
      appendChatMessage("Quiero algo picante.", false);
      appendBotTypingMessage(chefReplyByIntent("picante"), 760);
    });
    const strong = mkBtn("Busco algo contundente", false);
    strong.addEventListener("click", () => {
      appendChatMessage("Busco algo contundente.", false);
      appendBotTypingMessage(chefReplyByIntent("contundente"), 760);
    });
    const unsure = mkBtn("No me decido", false);
    unsure.addEventListener("click", () => {
      appendChatMessage("No me decido todavía.", false);
      appendBotTypingMessage(chefReplyByIntent(""), 760);
    });
    row.appendChild(spicy);
    row.appendChild(strong);
    row.appendChild(unsure);
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  }

  function appendClosedChatActions() {
    const el = document.getElementById("chat-messages");
    if (el.querySelector("[data-closed-actions]")) return;
    const row = document.createElement("div");
    row.setAttribute("data-closed-actions", "1");
    row.className = "mt-2 flex flex-wrap gap-2";
    const mkBtn = (label, isPrimary) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = isPrimary
        ? "btn-amicii-primary rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
        : "btn-amicii-outline rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide";
      b.textContent = label;
      return b;
    };
    const b1 = mkBtn("Sí, quiero reservar", true);
    b1.addEventListener("click", () => {
      appendChatMessage("Sí, quiero reservar", false);
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
      appendBotTypingMessage(
        "¡Perfecto! Elegí tus especialidades; al finalizar, tocá “Reservar para las 19:00” en el checkout. Tu pedido queda listo para salir del horno al abrir. Ottimo.",
        1500
      );
    });
    const b2 = mkBtn("Solo miro especialidades", false);
    b2.addEventListener("click", () => {
      appendChatMessage("Solo miro especialidades, gracias", false);
      appendBotTypingMessage("Cuando quieras, acá te esperamos con masa artesanal y mucho sabor. Buon appetit.", 1500);
    });
    row.appendChild(b1);
    row.appendChild(b2);
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  }

  function runInitialChatMessages() {
    if (window.__amiciiChatInit) return;
    window.__amiciiChatInit = true;
    let hasSeenChat = false;
    try {
      hasSeenChat = localStorage.getItem(LS_CHAT_SEEN) === "1";
    } catch (e) {}
    if (hasSeenChat) {
      setTimeout(() => appendBotTypingMessage(WELCOME_RETURNING, 1500), 300);
      setTimeout(() => appendBotTypingMessage(WELCOME_OPEN_ALT, 1500), 2100);
      setTimeout(() => appendSmartChatActions(), 3700);
      return;
    }
    if (storeState.isOpen) {
      setTimeout(() => appendBotTypingMessage(WELCOME_OPEN, 1500), 300);
      setTimeout(() => appendBotTypingMessage(WELCOME_OPEN_ALT, 1500), 2100);
      setTimeout(() => appendBotTypingMessage(TIP, 1500), 3900);
      setTimeout(() => appendSmartChatActions(), 5500);
    } else {
      setTimeout(() => appendBotTypingMessage(WELCOME_CLOSED, 1500), 300);
      setTimeout(() => appendBotTypingMessage(TIP, 1500), 2200);
      setTimeout(() => appendClosedChatActions(), 3900);
    }
    try {
      localStorage.setItem(LS_CHAT_SEEN, "1");
    } catch (e) {}
  }

  function showChat() {
    document.getElementById("chat-panel").classList.remove("hidden");
    chatOpen.value = true;
    runInitialChatMessages();
    startCompanionMessages();
  }

  document.getElementById("btn-chat-bubble").addEventListener("click", (e) => {
    e.stopPropagation();
    if (document.getElementById("chat-panel").classList.contains("hidden")) showChat();
    else {
      document.getElementById("chat-panel").classList.add("hidden");
      chatOpen.value = false;
      stopCompanionMessages();
      sessionStorage.setItem("amicii-chat-closed", "1");
    }
  });
  document.getElementById("btn-close-chat").addEventListener("click", () => {
    document.getElementById("chat-panel").classList.add("hidden");
    chatOpen.value = false;
    stopCompanionMessages();
    sessionStorage.setItem("amicii-chat-closed", "1");
  });

  const horaInit = document.getElementById("cart-reserva-hora");
  if (horaInit) {
    try {
      const sv = localStorage.getItem(LS_HORA);
      if (sv && Array.from(horaInit.options).some((o) => o.value === sv)) {
        horaInit.value = sv;
      }
    } catch (e) {}
    horaInit.addEventListener("change", function () {
      if (this.value) {
        try {
          localStorage.setItem(LS_HORA, this.value);
        } catch (e) {}
      }
    });
  }

  window.addEventListener("load", () => {
    setInterval(function () {
      updateFomoBanner();
      updateReservaBlock();
    }, 1000);
    setInterval(updateScheduleUI, 60000);
    setTimeout(() => {
      if (!window.__amiciiChatInit && !sessionStorage.getItem("amicii-chat-closed")) {
        showChat();
      }
    }, 5000);
  });

  updateScheduleUI();
  updateFomoBanner();
  updateReservaBlock();
  renderGrids();
  updateBadges();
  renderCart();
})();
