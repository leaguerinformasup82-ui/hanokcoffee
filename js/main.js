/* ================================================================
   HANOK COFFEE — main.js
   Modules: nav · parallax · menu-filter · search · gallery
            carousel · form-validation · fox-mascot · scroll-reveal
   Vanilla JS, no dependencies. IIFE pattern.
   ================================================================ */
(function () {
  'use strict';

  /* ── Shared state ──────────────────────────────────────────── */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Helpers ───────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function debounce(fn, ms) {
    let id;
    return function (...args) {
      clearTimeout(id);
      id = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Strip diacritics for accent-insensitive search
  function normalize(str) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();
  }

  /* ── 1. Navigation ─────────────────────────────────────────── */
  function initNav() {
    const header   = $('#site-header');
    const burger   = $('.nav-burger');
    const mobileNav = $('#nav-mobile');
    const closeBtn  = $('#nav-mobile-close');
    const navLinks  = $$('#nav-mobile a');

    // Header: become solid after scrolling past hero fold
    function onScroll() {
      header.classList.toggle('scrolled', window.scrollY > 60);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Burger toggle
    function openMenu() {
      mobileNav.classList.add('open');
      mobileNav.removeAttribute('aria-hidden');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Fermer le menu');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function closeMenu() {
      mobileNav.classList.remove('open');
      mobileNav.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Ouvrir le menu de navigation');
      document.body.style.overflow = '';
      burger.focus();
    }

    burger.addEventListener('click', () => {
      mobileNav.classList.contains('open') ? closeMenu() : openMenu();
    });
    closeBtn.addEventListener('click', closeMenu);

    // Close on nav link click or Escape
    navLinks.forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) closeMenu();
    });

    // Scroll-spy: highlight active nav link
    const sections = $$('section[id]');
    const allLinks = $$('#site-header .nav-links a[href^="#"]');

    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          allLinks.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(s => spy.observe(s));
  }

  /* ── 2. Hero parallax ──────────────────────────────────────── */
  function initParallax() {
    if (reducedMotion) return;
    const bg = $('.hero-bg');
    if (!bg) return;

    function onScroll() {
      const y = window.scrollY * 0.34;
      bg.style.transform = `translateY(${y}px)`;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── 3. Menu filter (tabs) ─────────────────────────────────── */
  function initMenuFilter() {
    const tabs    = $$('.filter-tab');
    const cards   = $$('.menu-card');
    const empty   = $('#menu-empty');
    const live    = $('#menu-live');
    let current   = 'all';

    function applyFilter(cat) {
      current = cat;
      let visible = 0;

      cards.forEach(card => {
        const matches =
          cat === 'all' ||
          card.dataset.category === cat ||
          (card.dataset.tags && card.dataset.tags.split(',').includes(cat));

        card.classList.toggle('is-hidden', !matches);
        if (matches) visible++;
      });

      // Update tabs ARIA
      tabs.forEach(t => {
        const sel = t.dataset.filter === cat;
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
      });

      // Update empty state
      if (empty) empty.hidden = visible > 0;

      // Announce to screen readers
      if (live) {
        live.textContent = visible === 0
          ? 'Aucun article ne correspond.'
          : `${visible} article${visible > 1 ? 's' : ''} affiché${visible > 1 ? 's' : ''}.`;
      }
    }

    // Click + keyboard navigation (roving tabindex)
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => applyFilter(tab.dataset.filter));

      tab.addEventListener('keydown', e => {
        let next = -1;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft')  next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home')       next = 0;
        if (e.key === 'End')        next = tabs.length - 1;
        if (next >= 0) {
          e.preventDefault();
          tabs[next].focus();
          applyFilter(tabs[next].dataset.filter);
        }
      });
    });
  }

  /* ── 4. Menu live search ───────────────────────────────────── */
  function initMenuSearch() {
    const input   = $('#menu-search');
    const results = $('#search-results');
    const cards   = $$('.menu-card');
    if (!input || !results) return;

    let focusedIdx = -1;
    let items = [];

    function closeResults() {
      results.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
      focusedIdx = -1;
    }

    function renderResults(q) {
      const norm = normalize(q);
      results.innerHTML = '';
      focusedIdx = -1;
      items = [];

      if (!norm) { closeResults(); return; }

      const matches = cards.filter(card => {
        return (
          normalize(card.dataset.nameKo  || '').includes(norm) ||
          normalize(card.dataset.nameFr  || '').includes(norm) ||
          normalize(card.dataset.desc    || '').includes(norm)
        );
      });

      if (matches.length === 0) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="res-empty">Aucun résultat pour « ${q} »</span>`;
        results.appendChild(li);
      } else {
        matches.forEach(card => {
          const li = document.createElement('li');
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', 'false');
          li.innerHTML = `
            <div class="res-names">
              <span class="res-ko">${card.dataset.nameKo}</span>
              <span class="res-fr">${card.dataset.nameFr}</span>
            </div>
            <span class="res-price">${card.querySelector('.menu-price').textContent}</span>
          `;
          li.addEventListener('click', () => scrollToCard(card, q));
          results.appendChild(li);
          items.push({ li, card });
        });
      }

      results.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
    }

    function scrollToCard(card, q) {
      // Scroll to menu section and highlight card
      closeResults();
      input.value = '';

      // Reset filter to show the card first
      $$('.filter-tab').forEach(t => {
        t.setAttribute('aria-selected', t.dataset.filter === 'all' ? 'true' : 'false');
      });
      $$('.menu-card').forEach(c => c.classList.remove('is-hidden'));

      // Scroll + highlight
      setTimeout(() => {
        card.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        card.classList.add('search-hl');
        setTimeout(() => card.classList.remove('search-hl'), 1400);
      }, 100);
    }

    // Keyboard navigation in results
    function updateFocus(newIdx) {
      items.forEach((item, i) => item.li.classList.toggle('sr-focused', i === newIdx));
      focusedIdx = newIdx;
    }

    input.addEventListener('input', debounce(e => renderResults(e.target.value), 200));

    input.addEventListener('keydown', e => {
      if (!results.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateFocus(Math.min(focusedIdx + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateFocus(Math.max(focusedIdx - 1, 0));
      } else if (e.key === 'Enter' && focusedIdx >= 0) {
        e.preventDefault();
        scrollToCard(items[focusedIdx].card, input.value);
      } else if (e.key === 'Escape') {
        closeResults();
      }
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !results.contains(e.target)) closeResults();
    });
  }

  /* ── 5. Gallery lightbox ───────────────────────────────────── */
  function initGallery() {
    const dialog  = $('#lightbox');
    const closeBtn = $('#lb-close');
    const ph      = $('#lb-ph');
    const caption = $('#lb-caption');
    const items   = $$('.gallery-item');
    if (!dialog) return;

    let currentIdx = 0;

    function openLightbox(idx) {
      currentIdx = idx;
      const item = items[idx];
      const thumb = item.querySelector('.gallery-thumb');
      const cap   = item.dataset.caption || '';

      // Clone the thumb into the lightbox
      if (ph) {
        ph.innerHTML = '';
        const clone = thumb.cloneNode(true);
        clone.classList.add(...thumb.classList);
        // Remove masonry sizing, let it be natural
        clone.style.aspectRatio = '';
        clone.style.maxWidth = '500px';
        clone.style.height = 'min(400px, 70vh)';
        ph.appendChild(clone);
      }
      if (caption) caption.textContent = cap;

      dialog.showModal();
    }

    function closeLightbox() { dialog.close(); }

    items.forEach((item, idx) => {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Agrandir : ${item.dataset.caption || 'photo'}`);

      item.addEventListener('click', () => openLightbox(idx));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(idx);
        }
      });
    });

    closeBtn && closeBtn.addEventListener('click', closeLightbox);

    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeLightbox();
    });

    // Click outside dialog content closes it
    dialog.addEventListener('click', e => {
      if (e.target === dialog) closeLightbox();
    });
  }

  /* ── 6. Events carousel ────────────────────────────────────── */
  function initCarousel() {
    const track    = $('#carousel-track');
    const dots     = $$('.carousel-dot');
    const prevBtn  = $('#carousel-prev');
    const nextBtn  = $('#carousel-next');
    const slides   = $$('.carousel-slide');
    if (!track || slides.length === 0) return;

    let current  = 0;
    let autoTimer = null;
    const total  = slides.length;

    function goTo(idx, announce = true) {
      current = (idx + total) % total;

      if (reducedMotion) {
        track.style.transition = 'none';
      }
      track.style.transform = `translateX(-${current * 100}%)`;

      // Update dots
      dots.forEach((d, i) => {
        const active = i === current;
        d.classList.toggle('active', active);
        d.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      // Update slide aria-label
      slides.forEach((s, i) => {
        const orig = s.getAttribute('aria-label') || '';
        // Replace "X sur N" prefix
        s.setAttribute('aria-label', orig.replace(/^\d+ sur \d+ : /, `${i + 1} sur ${total} : `));
      });

      // Announce to screen reader (only on manual nav)
      if (announce) {
        track.setAttribute('aria-live', 'polite');
        setTimeout(() => track.setAttribute('aria-live', 'off'), 800);
      }
    }

    function startAuto() {
      if (reducedMotion) return;
      stopAuto();
      autoTimer = setInterval(() => goTo(current + 1, false), 5000);
    }
    function stopAuto() {
      clearInterval(autoTimer);
      autoTimer = null;
    }

    prevBtn && prevBtn.addEventListener('click', () => { goTo(current - 1); startAuto(); });
    nextBtn && nextBtn.addEventListener('click', () => { goTo(current + 1); startAuto(); });

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(parseInt(dot.dataset.slide, 10));
        startAuto();
      });
    });

    // Keyboard on carousel region
    const region = $('.carousel');
    region && region.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { goTo(current - 1); startAuto(); }
      if (e.key === 'ArrowRight') { goTo(current + 1); startAuto(); }
    });

    // Pause on hover / focus
    region && region.addEventListener('mouseenter', stopAuto);
    region && region.addEventListener('mouseleave', startAuto);
    region && region.addEventListener('focusin',    stopAuto);
    region && region.addEventListener('focusout',   startAuto);

    // Touch swipe
    let touchStartX = 0;
    track.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    track.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        dx < 0 ? goTo(current + 1) : goTo(current - 1);
        startAuto();
      }
    }, { passive: true });

    goTo(0, false);
    startAuto();
  }

  /* ── 7. Contact form validation ────────────────────────────── */
  function initForm() {
    const form   = $('#contact-form');
    const submit = $('#form-submit');
    const status = $('#form-status');
    if (!form) return;

    const rules = {
      'f-name':    { required: true, label: 'Le nom' },
      'f-email':   { required: true, type: 'email', label: "L'e-mail" },
      'f-message': { required: true, minLength: 10, label: 'Le message' },
    };

    function getError(id, val) {
      const r = rules[id];
      if (!r) return '';
      if (r.required && !val.trim()) return `${r.label} est requis.`;
      if (r.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        return 'Adresse e-mail invalide.';
      }
      if (r.minLength && val.trim().length < r.minLength) {
        return `${r.label} doit comporter au moins ${r.minLength} caractères.`;
      }
      return '';
    }

    function showErr(input, msg) {
      const err = $(`#e-${input.id.replace('f-', '')}`);
      input.classList.toggle('invalid', !!msg);
      if (err) {
        err.textContent = msg;
        err.classList.toggle('visible', !!msg);
      }
    }

    // Live validation on blur
    Object.keys(rules).forEach(id => {
      const el = $(`#${id}`);
      if (!el) return;
      el.addEventListener('blur',  () => showErr(el, getError(id, el.value)));
      el.addEventListener('input', () => {
        if (el.classList.contains('invalid')) showErr(el, getError(id, el.value));
      });
    });

    form.addEventListener('submit', e => {
      e.preventDefault();

      // Validate all
      let firstErr = null;
      Object.keys(rules).forEach(id => {
        const el = $(`#${id}`);
        if (!el) return;
        const err = getError(id, el.value);
        showErr(el, err);
        if (err && !firstErr) firstErr = el;
      });

      if (firstErr) {
        firstErr.focus();
        return;
      }

      // Simulate async submit
      submit.disabled = true;
      submit.textContent = 'Envoi en cours…';

      setTimeout(() => {
        submit.disabled = false;
        submit.textContent = 'Envoyer le message';

        // Show success
        if (status) {
          status.textContent = '✓ Message envoyé ! Nous vous répondrons sous 24h.';
          status.className = 'form-status visible ok';
          setTimeout(() => {
            status.className = 'form-status';
          }, 6000);
        }
        form.reset();
        Object.keys(rules).forEach(id => {
          const el = $(`#${id}`);
          if (el) el.classList.remove('invalid');
        });
      }, 1200);
    });
  }

  /* ── 8. Fox mascot ─────────────────────────────────────────── */
  function initFox() {
    const wrapper = $('#fox-wrapper');
    const fox     = $('#fox-mascot');
    if (!wrapper || !fox) return;

    const SIZE   = 100;
    const MARGIN = 22;

    function homePos() {
      return {
        x: window.innerWidth  - SIZE - MARGIN,
        y: window.innerHeight - SIZE - MARGIN,
      };
    }

    const h0 = homePos();
    let posX = h0.x, posY = h0.y;
    let tgtX = h0.x, tgtY = h0.y;
    let mouseX = h0.x + SIZE / 2;
    let mouseY = h0.y + SIZE / 2;
    let focused = false;
    let bouncing = false;
    let shaking  = false;
    let shakeDebounce = null;

    function moveTo(el) {
      const rect = el.getBoundingClientRect();
      let x = rect.right + 12;
      let y = rect.top + (rect.height - SIZE) / 2;

      if (x + SIZE > window.innerWidth - 6) {
        x = rect.left - SIZE - 12;
      }
      x = clamp(x, 6, window.innerWidth  - SIZE - 6);
      y = clamp(y, 6, window.innerHeight - SIZE - 6);
      tgtX = x;
      tgtY = y;
    }

    function triggerBounce() {
      if (reducedMotion || bouncing) return;
      fox.classList.remove('fox-bounce');
      void fox.offsetWidth; // force reflow
      fox.classList.add('fox-bounce');
      bouncing = true;
    }
    fox.addEventListener('animationend', e => {
      if (e.animationName === 'foxBounce') { fox.classList.remove('fox-bounce'); bouncing = false; }
      if (e.animationName === 'foxShake')  { fox.classList.remove('fox-shake');  shaking  = false; }
    });

    function triggerShake() {
      if (reducedMotion || shaking) return;
      clearTimeout(shakeDebounce);
      shakeDebounce = setTimeout(() => {
        fox.classList.remove('fox-shake');
        void fox.offsetWidth;
        fox.classList.add('fox-shake');
        shaking = true;
      }, 80);
    }

    // Mouse tracking
    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    document.addEventListener('mouseleave', () => {
      const h = homePos();
      mouseX = h.x + SIZE / 2;
      mouseY = h.y + SIZE / 2;
    });
    window.addEventListener('resize', () => {
      if (!focused) {
        const h = homePos();
        posX = h.x; posY = h.y;
        tgtX = h.x; tgtY = h.y;
      }
    });

    // Focus: slide to search input
    const searchInput = $('#menu-search');
    if (searchInput) {
      searchInput.addEventListener('focus', () => {
        focused = true;
        moveTo(searchInput);
        triggerBounce();
      });
      searchInput.addEventListener('keydown', triggerShake);
      searchInput.addEventListener('blur', () => { focused = false; });
    }

    // Focus: contact form inputs
    $$('#contact-form input, #contact-form textarea, #contact-form select').forEach(el => {
      el.addEventListener('focus', () => {
        focused = true;
        moveTo(el);
        triggerBounce();
      });
      el.addEventListener('input', debounce(triggerBounce, 300));
      el.addEventListener('blur', () => { focused = false; });
    });

    // RAF loop
    function tick() {
      if (!reducedMotion) {
        if (!focused) {
          // Soft drift toward mouse from home anchor
          const h = homePos();
          const dx = mouseX - (h.x + SIZE / 2);
          const dy = mouseY - (h.y + SIZE / 2);
          const dist = Math.hypot(dx, dy) || 1;
          const max  = 60;
          const s    = Math.min(dist, max) / dist * 0.38;
          tgtX = h.x + dx * s;
          tgtY = h.y + dy * s;
        }
        posX = lerp(posX, tgtX, 0.07);
        posY = lerp(posY, tgtY, 0.07);
      } else {
        posX = tgtX;
        posY = tgtY;
      }
      wrapper.style.transform = `translate(${posX | 0}px,${posY | 0}px)`;
      requestAnimationFrame(tick);
    }

    wrapper.style.transform = `translate(${posX | 0}px,${posY | 0}px)`;
    requestAnimationFrame(tick);
  }

  /* ── 9. Scroll-reveal (IntersectionObserver) ───────────────── */
  function initReveal() {
    if (reducedMotion) {
      // Mark all as visible immediately
      $$('[data-reveal]').forEach(el => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger siblings inside a grid
          const delay = entry.target.closest('.menu-grid, .about-grid, .gallery-grid')
            ? Array.from(entry.target.parentElement.children).indexOf(entry.target) * 60
            : 0;
          setTimeout(() => entry.target.classList.add('revealed'), delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    $$('[data-reveal]').forEach(el => observer.observe(el));
  }

  /* ── Init ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initParallax();
    initMenuFilter();
    initMenuSearch();
    initGallery();
    initCarousel();
    initForm();
    initFox();
    initReveal();
  });

})();
