/* AnimEngine (embedded) - lightweight tween + triggers - OPTIMIZED */
(function (global) {
  'use strict';
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
  const isNumber = v => typeof v === 'number' && isFinite(v);
  function parseColor(s) { if (!s) return null; s = String(s).trim(); if (s[0] === '#') { if (s.length === 4) return [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16)]; if (s.length === 7) return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; } const m = s.match(/rgba?\(\s*([0-9]+)[^\d]+([0-9]+)[^\d]+([0-9]+)/i); if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]; return null; }
  function colorToString(c) { return Array.isArray(c) ? ('rgb(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ')') : ''; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpColor(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  const Easings = { linear: t => t, easeInCubic: t => t * t * t, easeOutCubic: t => --t * t * t + 1, easeOutQuad: t => t * (2 - t), easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1, outQuad: t => t * (2 - t), ease: t => t * (2 - t) };
  class Tween { constructor({ from, to, duration = 400, easing = Easings.linear, delay = 0, onUpdate = () => { }, onComplete = () => { }, propType = 'number', meta = null } = {}) { this.from = from; this.to = to; this.duration = duration; this.easing = typeof easing === 'function' ? easing : (Easings[easing] || Easings.linear); this.delay = delay; this.onUpdate = onUpdate; this.onComplete = onComplete; this.propType = propType; this.meta = meta; this._start = null; this._raf = null; this._stopped = false; } start() { const loop = (t) => { if (this._stopped) return; if (this._start == null) this._start = t + this.delay; const elapsed = t - this._start; if (elapsed < 0) { this._raf = requestAnimationFrame(loop); return; } const raw = clamp(elapsed / Math.max(1, this.duration)); const eased = this.easing(raw); let v; if (this.propType === 'color') v = lerpColor(this.from, this.to, eased); else v = lerp(this.from, this.to, eased); this.onUpdate(v, eased, raw, this.meta); if (raw < 1) this._raf = requestAnimationFrame(loop); else this.onComplete(); }; this._raf = requestAnimationFrame(loop); return this; } stop() { this._stopped = true; if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; } }
  function buildTransformString(map) { const parts = []; if ('translateX' in map || 'translateY' in map || 'translateZ' in map) { const x = map.translateX || 0; const y = map.translateY || 0; const z = map.translateZ || 0; parts.push('translate3d(' + (isNumber(x) ? x + 'px' : x) + ', ' + (isNumber(y) ? y + 'px' : y) + ', ' + (isNumber(z) ? z + 'px' : z) + ')'); } if ('scale' in map) parts.push('scale(' + map.scale + ')'); if ('scaleX' in map) parts.push('scaleX(' + map.scaleX + ')'); if ('scaleY' in map) parts.push('scaleY(' + map.scaleY + ')'); if ('rotate' in map) parts.push('rotate(' + (isNumber(map.rotate) ? map.rotate + 'deg' : map.rotate) + ')'); if ('skewX' in map) parts.push('skewX(' + (isNumber(map.skewX) ? map.skewX + 'deg' : map.skewX) + ')'); if ('skewY' in map) parts.push('skewY(' + (isNumber(map.skewY) ? map.skewY + 'deg' : map.skewY) + ')'); return parts.join(' '); }
  const AnimEngine = {
    Easings, tween: function (element, props = {}, opts = {}) {
      if (!element || !element.style) return;
      // Stop any existing animations on this element
      if (element.__anim_tweens) {
        element.__anim_tweens.forEach(t => t.stop());
        element.__anim_tweens = [];
      }
      const duration = opts.duration != null ? opts.duration : 400; const easing = opts.easing || 'linear'; const delay = opts.delay || 0; const tweens = [];
      // Force reflow to get accurate computed styles
      void element.offsetHeight;
      const cs = window.getComputedStyle(element);
      // handle props
      Object.keys(props).forEach((key) => {
        const rawTo = props[key]; if (/^translate(X|Y|Z)$/.test(key) || /^(scale|scaleX|scaleY|rotate|skewX|skewY)$/.test(key)) { // transform handled below via element.__anim_transform
          if (!element.__anim_transform) element.__anim_transform = {};
          // Read CURRENT transform value (from inline style or computed style)
          let fromVal = (/^scale/.test(key)) ? 1 : 0;
          // First check if we have a current value in our transform map
          if (element.__anim_transform[key] !== undefined) {
            fromVal = element.__anim_transform[key];
          } else {
            // Read from computed style
            const existingTransform = cs.transform || cs.webkitTransform || element.style.transform || '';
            if (existingTransform && existingTransform !== 'none') {
              if (/^scale/.test(key)) {
                const scaleMatch = existingTransform.match(/scale\(([^)]+)\)/);
                if (scaleMatch) fromVal = parseFloat(scaleMatch[1]);
                // If still default and element has menu-item-circle class, default to 0
                if (fromVal === 1 && element.classList && element.classList.contains('menu-item-circle')) {
                  fromVal = 0;
                }
              } else if (/^translateX/.test(key)) {
                // Try multiple patterns: translateX(), translate(), translate3d(), or matrix()
                let txMatch = existingTransform.match(/translateX\(([^,)]+)/);
                if (!txMatch) txMatch = existingTransform.match(/translate\(([^,)]+)/); // CSS shorthand translate(-14px)
                if (!txMatch) txMatch = existingTransform.match(/translate3d\(([^,)]+)/);
                if (txMatch) fromVal = parseFloat(txMatch[1]);
                // If still default, try matrix format
                if (fromVal === 0) {
                  const matrixMatch = existingTransform.match(/matrix\(([^)]+)\)/);
                  if (matrixMatch) {
                    const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (values.length >= 6) fromVal = values[4]; // translateX is in matrix[4]
                  }
                }
                // If still default and element has menu-item-text class, default to -14 based on CSS
                if (fromVal === 0 && element.classList && element.classList.contains('menu-item-text')) {
                  fromVal = -14;
                }
              } else if (/^translateY/.test(key)) {
                const tyMatch = existingTransform.match(/translate(?:3d|Y)?\([^,]*,\s*([^,)]+)/);
                if (tyMatch) fromVal = parseFloat(tyMatch[1]);
              } else if (/^rotate/.test(key)) {
                const rotMatch = existingTransform.match(/rotate\(([^)]+)/);
                if (rotMatch) fromVal = parseFloat(rotMatch[1]);
              }
            } else {
              // No transform found in computed style - check if CSS has it via matrix
              if (existingTransform === 'none' || !existingTransform) {
                // Force a reflow and check computed style again
                void element.offsetHeight;
                const freshCS = window.getComputedStyle(element);
                const freshTransform = freshCS.transform;
                if (freshTransform && freshTransform !== 'none') {
                  // Try to extract from matrix
                  const matrixMatch = freshTransform.match(/matrix\(([^)]+)\)/);
                  if (matrixMatch) {
                    const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (values.length >= 6) {
                      if (/^translateX/.test(key)) fromVal = values[4];
                      else if (/^translateY/.test(key)) fromVal = values[5];
                      else if (/^scale/.test(key)) {
                        // Scale from matrix: sqrt(a^2 + b^2)
                        fromVal = Math.sqrt(values[0] * values[0] + values[1] * values[1]);
                      }
                    }
                  }
                }
              }
              // If still default, use CSS class-based defaults
              if (fromVal === ((/^scale/.test(key)) ? 1 : 0)) {
                if (/^scale/.test(key) && element.classList && element.classList.contains('menu-item-circle')) {
                  fromVal = 0;
                } else if (/^translateX/.test(key) && element.classList && element.classList.contains('menu-item-text')) {
                  fromVal = -14;
                }
              }
            }
          }
          const toVal = parseFloat(rawTo);
          // Initialize transform map with current value
          element.__anim_transform[key] = fromVal;
          // Build initial transform string to ensure it's set
          element.style.transform = buildTransformString(element.__anim_transform);
          const tw = new Tween({ from: fromVal, to: toVal, duration: duration, easing: easing, delay: delay, propType: 'number', meta: key, onUpdate: (val, _, __, meta) => { element.__anim_transform[meta] = val; element.style.transform = buildTransformString(element.__anim_transform); } });
          tweens.push(tw);
          return;
        }
        if (key === 'backgroundColor' || key === 'color' || key === 'borderColor') {
          // For backgroundColor with rgba, interpolate alpha channel properly
          if (key === 'backgroundColor' && typeof rawTo === 'string' && rawTo.includes('rgba')) {
            // Parse rgba values including alpha
            const rgbaMatch = rawTo.match(/rgba?\(([^)]+)\)/);
            if (rgbaMatch) {
              const parts = rgbaMatch[1].split(',').map(s => parseFloat(s.trim()));
              const toR = parts[0] || 255, toG = parts[1] || 255, toB = parts[2] || 255, toA = parts[3] !== undefined ? parts[3] : 1;
              // Get current rgba
              const curBg = cs.getPropertyValue('backgroundColor') || 'rgba(0,0,0,0)';
              const curRgbaMatch = curBg.match(/rgba?\(([^)]+)\)/);
              let fromR = toR, fromG = toG, fromB = toB, fromA = 0; // Default to target color with 0 alpha if current is invalid
              if (curRgbaMatch) {
                const curParts = curRgbaMatch[1].split(',').map(s => parseFloat(s.trim()));
                // If current alpha is 0, use target RGB
                if ((curParts[3] !== undefined ? curParts[3] : 1) === 0) {
                  fromR = toR; fromG = toG; fromB = toB; fromA = 0;
                } else {
                  fromR = curParts[0] || 0; fromG = curParts[1] || 0; fromB = curParts[2] || 0; fromA = curParts[3] !== undefined ? curParts[3] : 1;
                }
              }
              // Interpolate rgba with alpha
              const tw = new Tween({
                from: 0, to: 1, duration: duration, easing: easing, delay: delay, propType: 'number',
                onUpdate: (t) => {
                  const r = Math.round(lerp(fromR, toR, t));
                  const g = Math.round(lerp(fromG, toG, t));
                  const b = Math.round(lerp(fromB, toB, t));
                  const a = lerp(fromA, toA, t);
                  element.style[key] = `rgba(${r},${g},${b},${a})`;
                }
              });
              tweens.push(tw);
              return;
            }
          }
          const cur = parseColor(cs.getPropertyValue(key)) || [0, 0, 0];
          const to = parseColor(rawTo) || cur;
          const tw = new Tween({ from: cur, to: to, duration: duration, easing: easing, delay: delay, propType: 'color', onUpdate: (val) => { element.style[key] = colorToString(val); } });
          tweens.push(tw);
          return;
        }
        if (key === 'filterBlur') { const curFilter = cs.getPropertyValue('filter') || ''; const m = (curFilter || '').match(/blur\(([-0-9.]+)px\)/); const curVal = m ? parseFloat(m[1]) : 0; const to = parseFloat(rawTo); const tw = new Tween({ from: curVal, to: to, duration: duration, easing: easing, delay: delay, propType: 'number', onUpdate: (val) => { element.style.filter = 'blur(' + val + 'px)'; } }); tweens.push(tw); return; }
        if (key === 'opacity') { const cur = parseFloat(cs.opacity) || 0; const to = parseFloat(rawTo); const tw = new Tween({ from: cur, to: to, duration: duration, easing: easing, delay: delay, propType: 'number', onUpdate: (val) => { element.style.opacity = val; } }); tweens.push(tw); return; }
        if (key === 'value') { const toVal = rawTo; const tw = new Tween({ from: 0, to: 1, duration: 1, onUpdate: () => { }, onComplete: () => { try { if ('value' in element) element.value = toVal; else if (toVal === 'flex' || toVal === 'none') { const sideMenu = document.querySelector('.side-menu'); if (sideMenu) sideMenu.style.display = toVal; } } catch (e) { } } }); tweens.push(tw); return; }
        // numeric px
        const numPx = (/^\-?\d+(\.\d+)?(px)?$/i.test(String(rawTo))); if (numPx) { const toNum = parseFloat(rawTo); let curVal = parseFloat(cs.getPropertyValue(key)); if (!isNumber(curVal)) curVal = 0; const tw = new Tween({ from: curVal, to: toNum, duration: duration, easing: easing, delay: delay, propType: 'number', onUpdate: (val) => { element.style[key] = (key === 'opacity' ? val : (/px$/.test(String(rawTo)) || key === 'width' || key === 'height' || key === 'top' || key === 'left' ? val + 'px' : val)); } }); tweens.push(tw); return; }
        // fallback: set immediately
        try { element.style[key] = rawTo; } catch (e) { }
      });
      // Store tweens on element for cleanup
      if (!element.__anim_tweens) element.__anim_tweens = [];
      element.__anim_tweens.push(...tweens);
      // start tweens
      tweens.forEach(t => t.start()); return { stop: () => { tweens.forEach(t => { t.stop && t.stop(); if (element.__anim_tweens) { const idx = element.__anim_tweens.indexOf(t); if (idx >= 0) element.__anim_tweens.splice(idx, 1); } }); } };
    }, // end tween
    timeline: function () { /* not used in generated init */ }, onClick: function (selectorOrElement, handler) { if (typeof selectorOrElement === 'string') { document.addEventListener('click', function (e) { const el = e.target.closest(selectorOrElement); if (el) handler(el, e); }, false); } else if (selectorOrElement && selectorOrElement.addEventListener) { selectorOrElement.addEventListener('click', function (e) { handler(selectorOrElement, e); }); } }, onDoubleClick: function (selectorOrElement, handler, timeout = 300) { if (typeof selectorOrElement === 'string') { const clicks = new Map(); document.addEventListener('click', (e) => { const el = e.target.closest(selectorOrElement); if (!el) return; const t = performance.now(); const last = clicks.get(el) || 0; if (t - last <= timeout) { clicks.set(el, 0); handler(el, e); } else { clicks.set(el, t); } }, false); } else if (selectorOrElement && selectorOrElement.addEventListener) { let last = 0; selectorOrElement.addEventListener('click', (e) => { const t = performance.now(); if (t - last <= timeout) handler(selectorOrElement, e); last = t; }); } }, onHover: function (selectorOrElement, enterFn, leaveFn) { if (typeof selectorOrElement === 'string') { document.addEventListener('mouseover', function (e) { const el = e.target.closest(selectorOrElement); if (el) enterFn(el, e); }, false); document.addEventListener('mouseout', function (e) { const el = e.target.closest(selectorOrElement); if (el) leaveFn(el, e); }, false); } else if (selectorOrElement && selectorOrElement.addEventListener) { selectorOrElement.addEventListener('mouseenter', function (e) { enterFn(selectorOrElement, e); }); selectorOrElement.addEventListener('mouseleave', function (e) { leaveFn(selectorOrElement, e); }); } }, onEnterViewport: function (selectorOrElement, optsOrCb, maybeCb) { let options = {}; let callback; if (typeof optsOrCb === 'function') { callback = optsOrCb; } else { options = optsOrCb || {}; callback = maybeCb; } const once = options.once == null ? true : !!options.once; const io = new IntersectionObserver(function (entries) { entries.forEach(function (entry) { if (entry.isIntersecting) { callback(entry.target, entry); if (once) io.unobserve(entry.target); } }); }, { threshold: options.threshold || 0.1, rootMargin: options.rootMargin || '0px' }); if (typeof selectorOrElement === 'string') { document.querySelectorAll(selectorOrElement).forEach(function (el) { io.observe(el); }); } else { io.observe(selectorOrElement); } return { disconnect: () => io.disconnect() }; }, show: function (el) { if (!el) return; el.style.display = ''; el.style.opacity = 1; }, hide: function (el) { if (!el) return; el.style.display = 'none'; }, toggleClass: function (el, cls) { el && el.classList && el.classList.toggle(cls); }, throttle: function (fn, wait = 50) { let last = 0; return function (...args) { const t = now(); if (t - last >= wait) { last = t; fn.apply(this, args); } } }
  }; global.AnimEngine = AnimEngine;
})(typeof window !== 'undefined' ? window : this);


// ---- Complete Initialization of ALL animations ----
document.addEventListener('DOMContentLoaded', function () {
  // Initialize menu item transforms to their CSS initial state
  // Use a small delay to ensure CSS has been applied
  setTimeout(function () {
    document.querySelectorAll('.menu-item').forEach(function (menuItem) {
      const circle = menuItem.querySelector('.menu-item-circle');
      const text = menuItem.querySelector('.medium-s.menu-item-text');
      const isActive = menuItem.classList.contains('active');

      if (circle) {
        if (!circle.__anim_transform) circle.__anim_transform = {};
        // Force reflow to get accurate computed styles
        void circle.offsetHeight;
        // Active items should show the circle, inactive should be hidden
        circle.__anim_transform.scale = isActive ? 1 : 0;
        // Use !important equivalent by setting inline style with higher specificity
        circle.style.setProperty('transform', isActive ? 'scale(1)' : 'scale(0)');
        // Ensure transform is applied
        circle.style.willChange = 'transform';
        // Make sure circle is visible for active items
        if (isActive) {
          circle.style.opacity = '1';
        }
      }
      if (text) {
        if (!text.__anim_transform) text.__anim_transform = {};
        // Force reflow to get accurate computed styles
        void text.offsetHeight;
        // Active items should have text at normal position, inactive should be offset
        text.__anim_transform.translateX = isActive ? 0 : -14;
        // Use !important equivalent by setting inline style with higher specificity
        text.style.setProperty('transform', isActive ? 'translateX(0)' : 'translateX(-14px)');
        // Ensure transform is applied
        text.style.willChange = 'transform';
      }
    });
  }, 50);

  // Menu Item Hover - Combined enter/leave handler (faster, more responsive)
  // Use a small delay to ensure initialization is complete
  setTimeout(function () {
    document.querySelectorAll('.menu-item').forEach(function (el) {
      const circle = el.querySelector('.menu-item-circle');
      const text = el.querySelector('.medium-s.menu-item-text');
      if (circle && text) {
        // Check if this is the active/current menu item
        const isActive = el.classList.contains('active');

        // Ensure transform maps are initialized
        if (!circle.__anim_transform) {
          circle.__anim_transform = {};
          circle.__anim_transform.scale = isActive ? 1 : 0;
        }
        if (!text.__anim_transform) {
          text.__anim_transform = {};
          text.__anim_transform.translateX = isActive ? 0 : -14;
        }

        // For active items, ensure circle and text are in correct position immediately
        if (isActive) {
          circle.style.setProperty('transform', 'scale(1)');
          text.style.setProperty('transform', 'translateX(0)');
          circle.style.opacity = '1';
        }

        AnimEngine.onHover(el, function () {
          // On hover: show circle and move text (faster animation - 200ms)
          AnimEngine.tween(circle, { "scale": 1 }, { "duration": 200, "easing": "easeOutCubic", "delay": 0 });
          AnimEngine.tween(text, { "translateX": 0 }, { "duration": 200, "easing": "easeOutCubic", "delay": 0 });
        }, function () {
          // On hover out: only animate back if NOT active
          if (!isActive) {
            AnimEngine.tween(circle, { "scale": 0 }, { "duration": 200, "easing": "easeOutCubic", "delay": 0 });
            AnimEngine.tween(text, { "translateX": -14 }, { "duration": 200, "easing": "easeOutCubic", "delay": 0 });
          } else {
            // If active, ensure circle and text stay in correct position
            circle.style.setProperty('transform', 'scale(1)');
            text.style.setProperty('transform', 'translateX(0)');
          }
        });
      }
    });
  }, 100);

  // Status Indicator - Continuous breathing/pulsing animation
  document.querySelectorAll('.status-indicator').forEach(function (el) {
    // Initialize transform map
    if (!el.__anim_transform) el.__anim_transform = {};
    el.__anim_transform.scale = 1;
    el.style.transform = 'scale(1)';

    function breathe() {
      // Scale from 1 to 0.75 (breathe in - subtle pulse)
      AnimEngine.tween(el, { "scale": 0.75 }, { "duration": 2000, "easing": "easeInOutCubic", "delay": 0 });
      setTimeout(function () {
        // Scale back to 1 (breathe out)
        AnimEngine.tween(el, { "scale": 1 }, { "duration": 2000, "easing": "easeInOutCubic", "delay": 0 });
        setTimeout(breathe, 2000); // Loop the animation
      }, 2000);
    }
    // Start breathing animation after a short delay
    setTimeout(breathe, 500);
  });

  // Person Avatar Hover - with wrapper background color (subtle change)
  document.querySelectorAll('.person-avatar-wrapper').forEach(function (el) {
    const avatar = el.querySelector('.person-avatar');
    if (avatar) {
      // Read initial background from CSS
      const initialBg = window.getComputedStyle(el).backgroundColor || 'rgba(255,255,255,0.05)';
      AnimEngine.onHover(el, function () {
        AnimEngine.tween(avatar, { "rotate": -10 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        // Very subtle background change - from 0.05 to 0.08 (not 0.1)
        AnimEngine.tween(el, { "backgroundColor": "rgba(255,255,255,0.08)" }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
      }, function () {
        AnimEngine.tween(avatar, { "rotate": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        // Return to initial background
        AnimEngine.tween(el, { "backgroundColor": initialBg }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
      });
    }
  });

  // Primary Button Hover - background color, text color, icon opacity (NOT button opacity!)
  document.querySelectorAll('.primary-button').forEach(function (el) {
    const icon = el.querySelector('.primary-button-icon');
    const text = el.querySelector('.medium-s');
    // Don't animate button opacity - only background, icon, and text
    // Read initial background from CSS (should be rgba(255,255,255,0.1))
    const initialBg = window.getComputedStyle(el).backgroundColor || 'rgba(255,255,255,0.1)';
    // Ensure button opacity is always 1
    el.style.opacity = '1';
    AnimEngine.onHover(el, function () {
      // Very subtle background change on hover (0.12 instead of 0.15 to avoid being too bright)
      AnimEngine.tween(el, { "backgroundColor": "rgba(255,255,255,0.12)" }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
      if (icon) AnimEngine.tween(icon, { "opacity": 1 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
      if (text) AnimEngine.tween(text, { "color": "rgba(255,255,255,1)" }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
    }, function () {
      // Return to initial background
      AnimEngine.tween(el, { "backgroundColor": initialBg }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
      if (icon) AnimEngine.tween(icon, { "opacity": 0.65 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
      if (text) AnimEngine.tween(text, { "color": "rgba(255,255,255,0.65)" }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
    });
  });

  // Quick Link Blocks - All animations handled by CSS transitions for smooth performance
  // No JavaScript needed - CSS :hover handles glow opacity, transform, filter, and background-color

  // Mobile Menu Toggle
  document.querySelectorAll('.mobile-menu-icon-wrapper').forEach(function (iconWrapper) {
    const sideMenu = document.querySelector('.side-menu');
    const closeIcon = document.querySelector('.mobile-menu-icon.close-icon');
    const openIcon = document.querySelector('.mobile-menu-icon.open-icon');
    let isOpen = false;
    if (sideMenu) {
      AnimEngine.onClick(iconWrapper, function () {
        if (!isOpen) {
          sideMenu.style.display = 'flex';
          AnimEngine.tween(sideMenu, { "translateX": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
          if (closeIcon) AnimEngine.tween(closeIcon, { "opacity": 0.65 }, { "duration": 350, "easing": "easeOutCubic", "delay": 0 });
          if (openIcon) AnimEngine.tween(openIcon, { "opacity": 0 }, { "duration": 350, "easing": "easeOutCubic", "delay": 0 });
          isOpen = true;
        } else {
          AnimEngine.tween(sideMenu, { "translateX": 100 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
          if (closeIcon) AnimEngine.tween(closeIcon, { "opacity": 0 }, { "duration": 350, "easing": "easeOutCubic", "delay": 0 });
          if (openIcon) AnimEngine.tween(openIcon, { "opacity": 0.65 }, { "duration": 350, "easing": "easeOutCubic", "delay": 0 });
          setTimeout(function () { sideMenu.style.display = 'none'; }, 500);
          isOpen = false;
        }
      });
    }
  });

  // Award Block Hover
  document.querySelectorAll('.award-block').forEach(function (el) {
    const glow = el.querySelector('.award-block-glow-wrapper');
    if (glow) {
      AnimEngine.onHover(el, function () { AnimEngine.tween(glow, { "opacity": 1 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 }); }, function () { AnimEngine.tween(glow, { "opacity": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 }); });
    }
  });

  // Collection Item Hover - only animate background opacity, let CSS handle transform
  document.querySelectorAll('.collection-item').forEach(function (el) {
    const bg = el.querySelector('.portfolio-item-bg');
    if (bg) {
      // Use CSS transition for smooth opacity changes, no JavaScript animation needed
      // CSS :hover will handle the transform, we just need to ensure bg opacity changes smoothly
      AnimEngine.onHover(el, function () {
        bg.style.opacity = '0.1';
      }, function () {
        bg.style.opacity = '0';
      });
    }
  });

  // Tech Stack Block Hover - with translateY, filterBlur, opacity
  document.querySelectorAll('.tech-stack-block').forEach(function (el) {
    const glow = el.querySelector('.tech-stack-block-glow-wrapper');
    const icon = el.querySelector('.tech-stack-icon');
    const name = el.querySelector('.medium-xs.tech-stack-name');
    if (glow) {
      AnimEngine.onHover(el, function () {
        AnimEngine.tween(glow, { "opacity": 1 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        if (icon) AnimEngine.tween(icon, { "translateY": -10 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        if (name) {
          AnimEngine.tween(name, { "translateY": -10, "opacity": 1, "filterBlur": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        }
      }, function () {
        AnimEngine.tween(glow, { "opacity": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        if (icon) AnimEngine.tween(icon, { "translateY": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        if (name) {
          AnimEngine.tween(name, { "translateY": 0, "opacity": 0, "filterBlur": 10 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 });
        }
      });
    }
  });

  // Social Button Hover
  document.querySelectorAll('.social-button').forEach(function (el) {
    const glow = el.querySelector('.social-button-glow-wrapper');
    if (glow) {
      AnimEngine.onHover(el, function () { AnimEngine.tween(glow, { "opacity": 1 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 }); }, function () { AnimEngine.tween(glow, { "opacity": 0 }, { "duration": 500, "easing": "easeOutCubic", "delay": 0 }); });
    }
  });
});
