gsap.registerPlugin(ScrollTrigger);

/* ==================== SETTINGS: change these ==================== */
const ORDER = {
  email: 'orders@yourdomain.com',   // where orders go when using the email option
  endpoint: ''                      // optional Formspree URL, e.g. 'https://formspree.io/f/xxxxxxx'
};

/* ==================== DATA ==================== */
const config = { tiers: 1, shape: 'round', flavor: 'vanilla' };
const BASE_PRICE = { 1: 45, 2: 75, 3: 110 };
const PREMIUM = { vanilla: 0, chocolate: 5, strawberry: 4, matcha: 8.5 };
const FLAVOR_HEX = { vanilla: 0xFFF1D6, chocolate: 0x5A3423, strawberry: 0xFFA3C2, matcha: 0x8DB255 };
const FLAVOR_LABEL = { vanilla: 'Vanilla buttercream', chocolate: 'Dark fudge ganache', strawberry: 'Strawberry cream', matcha: 'Matcha glaze' };
const TIER_H = [0.9, 0.8, 0.7], TIER_R = [1.8, 1.3, 0.9];
const SPRINKLE_HEX = [0xFF6B3D, 0xFF9EC4, 0xA9D8F5, 0xB8E8C8, 0xFFD93D];

let scene, camera, renderer, controls, cakeGroup, cakeTiers = [], particles;
let goldM, cherryM, stemM, idleTimer;
let scrollSpin = 0;
const priceVal = { v: 45 };

/* ==================== 3D SCENE ==================== */
function init3D() {
  const container = document.getElementById('canvas-container');
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 3.4, 9.8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 4.5;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.target.set(0, 0.4, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;
  controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer); });
  controls.addEventListener('end', () => { idleTimer = setTimeout(() => controls.autoRotate = true, 2500); });

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2c8b5, 0.6));

  const key = new THREE.DirectionalLight(0xfff3e6, 1.1);
  key.position.set(5, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xbfe3ff, 0.9);
  rim.position.set(-6, 4, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  floor.receiveShadow = true;
  scene.add(floor);

  goldM = new THREE.MeshPhysicalMaterial({ color: 0xE8C98A, metalness: 1, roughness: 0.22 });
  cherryM = new THREE.MeshPhysicalMaterial({ color: 0xD42A3A, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  stemM = new THREE.MeshStandardMaterial({ color: 0x4F7A36, roughness: 0.6 });

  cakeGroup = new THREE.Group();
  scene.add(cakeGroup);
  buildCakeMesh();
  buildSprinkles();

  new ResizeObserver(onResize).observe(container);
  requestAnimationFrame(loop);
}

function onResize() {
  const c = document.getElementById('canvas-container');
  if (!renderer) return;
  camera.aspect = c.clientWidth / c.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(c.clientWidth, c.clientHeight);
}

/* ==================== CAKE ==================== */
function makeTier(i) {
  const shape = config.shape, h = TIER_H[i], r = TIER_R[i];
  const g = new THREE.Group();

  const frost = new THREE.MeshPhysicalMaterial({ color: FLAVOR_HEX[config.flavor], roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: FLAVOR_HEX[config.flavor], roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });

  const body = new THREE.Mesh(
    shape === 'round' ? new THREE.CylinderGeometry(r, r * 1.02, h, 72) : new THREE.BoxGeometry(r * 2, h, r * 2),
    frost);
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  const top = new THREE.Mesh(
    shape === 'round' ? new THREE.TorusGeometry(r * 0.995, 0.06, 16, 96).rotateX(Math.PI / 2) : new THREE.BoxGeometry(r * 2 + 0.08, 0.08, r * 2 + 0.08),
    gloss);
  top.position.y = h;
  top.castShadow = true;
  g.add(top);

  const band = new THREE.Mesh(
    shape === 'round' ? new THREE.TorusGeometry(r * 1.01, 0.03, 12, 96).rotateX(Math.PI / 2) : new THREE.BoxGeometry(r * 2 + 0.03, 0.06, r * 2 + 0.03),
    goldM);
  band.position.y = h * 0.14;
  g.add(band);

  const dots = [];
  const dotG = new THREE.SphereGeometry(0.04, 10, 8);
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * Math.PI * 2;
    const m = new THREE.MeshStandardMaterial({ color: SPRINKLE_HEX[(k + i) % SPRINKLE_HEX.length], roughness: 0.4 });
    const d = new THREE.Mesh(dotG, m);
    d.position.set(Math.cos(a) * r * 0.96, h + 0.07, Math.sin(a) * r * 0.96);
    g.add(d);
    dots.push(d);
  }
  return { g, body, top, mats: [frost, gloss], h, r, dots, i };
}

function buildCakeMesh() {
  cakeTiers.forEach(t => {
    cakeGroup.remove(t.g);
    t.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  });
  cakeTiers = [];
  let y = -1.2;
  for (let i = 0; i < config.tiers; i++) {
    const t = makeTier(i);
    if (i === config.tiers - 1) addCherries(t);
    t.g.position.y = y - 4;
    cakeGroup.add(t.g);
    cakeTiers.push(t);
    gsap.to(t.g.position, { y, duration: 1.3, delay: i * 0.14, ease: 'elastic.out(1,0.6)' });
    t.g.scale.set(0.01, 0.01, 0.01);
    gsap.to(t.g.scale, { x: 1, y: 1, z: 1, duration: 1, delay: i * 0.14, ease: 'back.out(1.6)' });
    y += t.h;
  }
}

function addCherries(t) {
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2 + 0.6, rr = t.r * 0.5;
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), cherryM);
    c.position.set(Math.cos(a) * rr, t.h + 0.14, Math.sin(a) * rr);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), stemM);
    s.position.set(c.position.x * 1.05, t.h + 0.36, c.position.z * 1.05);
    s.rotation.z = 0.4 * Math.cos(a);
    s.rotation.x = 0.4 * Math.sin(a);
    t.g.add(c, s);
    gsap.from(c.scale, { x: 0, y: 0, z: 0, duration: 0.6, delay: 0.9 + k * 0.1, ease: 'back.out(3)' });
  }
}

function setFlavorColor(hex) {
  const c = new THREE.Color(hex);
  cakeTiers.forEach(t => t.mats.forEach(m => gsap.to(m.color, { r: c.r, g: c.g, b: c.b, duration: 0.7, ease: 'power2.out' })));
}

/* ==================== SPRINKLES (spring particles) ==================== */
function buildSprinkles() {
  const N = 260;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const P = { x: [], y: [], z: [], vx: [], vy: [], vz: [], ang: [], r: [], spd: [], fall: [] };
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    P.ang.push(Math.random() * Math.PI * 2);
    P.r.push(2.2 + Math.random() * 3.4);
    P.spd.push(0.6 + Math.random() * 0.8);
    P.x.push(0); P.z.push(0);
    P.y.push(Math.random() * 8 - 1.2);
    P.fall.push(0.006 + Math.random() * 0.012);
    P.vx.push(0); P.vy.push(0); P.vz.push(0);
    c.setHex(SPRINKLE_HEX[i % SPRINKLE_HEX.length]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const cx = cv.getContext('2d');
  const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr;
  cx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv);

  const mat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, map: tex, transparent: true, opacity: 0.95, depthWrite: false });
  particles = { geo, pos, P, N, points: new THREE.Points(geo, mat) };
  particles.points.frustumCulled = false;
  scene.add(particles.points);
}

function updateSprinkles(t) {
  const { P, pos, N, geo } = particles;
  for (let i = 0; i < N; i++) {
    const a = P.ang[i] + t * 0.12 * P.spd[i];
    const hx = Math.cos(a) * P.r[i], hz = Math.sin(a) * P.r[i];
    P.vx[i] += (hx - P.x[i]) * 0.011;
    P.vz[i] += (hz - P.z[i]) * 0.011;
    P.vx[i] *= 0.93; P.vz[i] *= 0.93; P.vy[i] *= 0.93;
    P.x[i] += P.vx[i];
    P.z[i] += P.vz[i];
    P.y[i] += P.vy[i] - P.fall[i];
    if (P.y[i] < -1.4) { P.y[i] = 6.2 + Math.random() * 1.4; P.vy[i] = 0; }
    pos[i * 3] = P.x[i];
    pos[i * 3 + 1] = P.y[i];
    pos[i * 3 + 2] = P.z[i];
  }
  geo.attributes.position.needsUpdate = true;
}

function burst(strength = 1) {
  const { P, N } = particles;
  for (let i = 0; i < N; i++) {
    const dx = P.x[i], dz = P.z[i], l = Math.hypot(dx, dz) || 1;
    const s = strength * (0.5 + Math.random() * 0.9);
    P.vx[i] += dx / l * s * 0.35;
    P.vz[i] += dz / l * s * 0.35;
    P.vy[i] += s * (0.12 + Math.random() * 0.22);
  }
}

/* ==================== KINETIC ACTIONS ==================== */
function squish() {
  cakeTiers.forEach((t, i) => {
    gsap.killTweensOf(t.g.scale);
    gsap.timeline({ delay: i * 0.07 })
      .to(t.g.scale, { x: 1.16, z: 1.16, y: 0.8, duration: 0.18, ease: 'power2.in' })
      .to(t.g.scale, { x: 0.94, z: 0.94, y: 1.13, duration: 0.25, ease: 'power2.out' })
      .to(t.g.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1,0.35)' });
  });
  burst(0.5);
}

function wobble() {
  gsap.fromTo(cakeGroup.rotation, { z: 0.07 }, {
    z: -0.07, duration: 0.35, repeat: 5, yoyo: true, ease: 'sine.inOut',
    onComplete: () => gsap.to(cakeGroup.rotation, { z: 0, duration: 0.8, ease: 'elastic.out(1,0.3)' })
  });
}

/* ==================== SELECTION & PRICE ==================== */
function setSelected(group, el) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.toggle('on', b === el));
}

function setTiers(n) {
  config.tiers = n;
  document.querySelectorAll('[data-group="tier"]').forEach(b =>
    b.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k < n)));
  document.getElementById('chip-tiers').textContent = ['Single', 'Double', 'Triple'][n - 1] + ' tier';
  buildCakeMesh();
  burst(0.8);
  updatePrice();
}

function setShape(s) {
  config.shape = s;
  buildCakeMesh();
  burst(0.7);
  updatePrice();
}

function setFlavor(f) {
  config.flavor = f;
  document.getElementById('chip-flavor').textContent = FLAVOR_LABEL[f];
  setFlavorColor(FLAVOR_HEX[f]);
  gsap.fromTo('#chip-flavor', { scale: 0.85 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
  burst(0.6);
  updatePrice();
}

function totalPrice() {
  return (BASE_PRICE[config.tiers] + PREMIUM[config.flavor]) * (config.shape === 'square' ? 1.1 : 1);
}

function updatePrice() {
  gsap.to(priceVal, {
    v: totalPrice(), duration: 0.7, ease: 'power3.out',
    onUpdate: () => { document.getElementById('live-price').textContent = '$' + priceVal.v.toFixed(2); }
  });
  gsap.fromTo('#live-price', { scale: 1.14, color: '#FF9EC4' }, { scale: 1, color: '#FFF5EA', duration: 0.6, ease: 'back.out(2.5)' });
}

/* ==================== TOAST ==================== */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  gsap.timeline()
    .fromTo(t, { y: 160 }, { y: 0, duration: 0.6, ease: 'back.out(1.6)' })
    .to(t, { y: 160, duration: 0.5, ease: 'power2.in' }, '+=2.2');
}

/* ==================== RENDER LOOP ==================== */
function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000;
  controls.update();
  cakeGroup.scale.y = 1 + Math.sin(t * 1.6) * 0.006;
  cakeGroup.rotation.y = scrollSpin;
  cakeTiers.forEach(tr => tr.dots.forEach((d, k) => { d.position.y = tr.h + 0.07 + Math.sin(t * 2 + k * 0.6) * 0.008; }));
  updateSprinkles(t);
  renderer.render(scene, camera);
}

/* ==================== ORDER FORM ==================== */
const modal = document.getElementById('order-modal');
const form = document.getElementById('order-form');
const msg = document.getElementById('order-msg');
const submitBtn = document.getElementById('order-submit');

function cakeDetails() {
  return `Tiers: ${config.tiers}\nShape: ${config.shape}\nFrosting: ${FLAVOR_LABEL[config.flavor]}\nEstimated total: $${totalPrice().toFixed(2)}`;
}

function openOrder() {
  document.getElementById('order-summary').textContent = cakeDetails().replace(/\n/g, ' · ');
  msg.textContent = '';
  modal.hidden = false;
  gsap.fromTo('#order-modal .sheet', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
  form.querySelector('input[name="name"]').focus();
}

function closeOrder() { modal.hidden = true; }

function sendByEmail(d, details) {
  const subject = encodeURIComponent('New cake order from ' + d.name);
  const body = encodeURIComponent(
    `Name: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone || '-'}\nDate: ${d.date}\n\n${details}\n\nNotes: ${d.notes || '-'}`);
  location.href = `mailto:${ORDER.email}?subject=${subject}&body=${body}`;
  msg.textContent = 'Your email app should open with the order. Press send to finish.';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const d = Object.fromEntries(new FormData(form));
  const details = cakeDetails();
  submitBtn.disabled = true;
  msg.textContent = 'Sending…';

  if (ORDER.endpoint) {
    try {
      const r = await fetch(ORDER.endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, cake: details })
      });
      if (!r.ok) throw new Error('send failed');
      msg.textContent = 'Thank you! We will email you to confirm.';
      form.reset();
      toast('Order sent');
    } catch (err) {
      msg.textContent = 'Could not send automatically. Opening your email app instead.';
      sendByEmail(d, details);
    }
  } else {
    sendByEmail(d, details);
  }
  submitBtn.disabled = false;
});

document.getElementById('add').addEventListener('click', openOrder);
document.getElementById('order-close').addEventListener('click', closeOrder);
modal.addEventListener('click', e => { if (e.target === modal) closeOrder(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeOrder(); });

/* ==================== CONTROLS ==================== */
function ripple(e, el) {
  const r = el.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.left = (e.clientX - r.left) + 'px';
  s.style.top = (e.clientY - r.top) + 'px';
  s.style.width = s.style.height = '40px';
  el.appendChild(s);
  setTimeout(() => s.remove(), 700);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-group]');
  if (!b) return;
  ripple(e, b);
  const g = b.dataset.group, v = b.dataset.value;
  setSelected(g, b);
  if (g === 'tier') setTiers(+v);
  if (g === 'shape') setShape(v);
  if (g === 'flavor') setFlavor(v);
});

document.querySelectorAll('.kin').forEach(k => k.addEventListener('click', e => ripple(e, k)));
document.getElementById('k-burst').addEventListener('click', () => burst(1.4));
document.getElementById('k-squish').addEventListener('click', squish);
document.getElementById('k-wobble').addEventListener('click', wobble);

/* magnetic buttons */
document.querySelectorAll('.btn, .brand').forEach(el => {
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.3, ease: 'power2.out' });
  });
  el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1,0.35)' }));
});

/* pointer-driven motion */
if (matchMedia('(hover: hover)').matches) {
  const glow = document.getElementById('glow');
  const qx = gsap.quickTo(glow, 'x', { duration: 0.6, ease: 'power3' });
  const qy = gsap.quickTo(glow, 'y', { duration: 0.6, ease: 'power3' });
  const sx = gsap.quickTo('#stage-inner', 'rotationY', { duration: 0.8, ease: 'power3' });
  const sy = gsap.quickTo('#stage-inner', 'rotationX', { duration: 0.8, ease: 'power3' });
  const stage = document.getElementById('stage');
  addEventListener('pointermove', e => {
    qx(e.clientX); qy(e.clientY);
    const r = stage.getBoundingClientRect();
    if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) {
      sx(((e.clientX - r.left) / r.width - 0.5) * 8);
      sy(-((e.clientY - r.top) / r.height - 0.5) * 6);
    } else { sx(0); sy(0); }
  });

  document.querySelectorAll('.feat').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      gsap.to(card, {
        rotationY: ((e.clientX - r.left) / r.width - 0.5) * 12,
        rotationX: -((e.clientY - r.top) / r.height - 0.5) * 10,
        translateY: -8, duration: 0.4, ease: 'power2.out'
      });
    });
    card.addEventListener('mouseleave', () => gsap.to(card, { rotationY: 0, rotationX: 0, translateY: 0, duration: 0.8, ease: 'elastic.out(1,0.4)' }));
  });

  const panel = document.getElementById('panel');
  panel.addEventListener('mousemove', e => {
    const r = panel.getBoundingClientRect();
    gsap.to(panel, {
      rotationY: ((e.clientX - r.left) / r.width - 0.5) * 2.5,
      rotationX: -((e.clientY - r.top) / r.height - 0.5) * 2,
      duration: 0.5, ease: 'power2.out'
    });
  });
  panel.addEventListener('mouseleave', () => gsap.to(panel, { rotationY: 0, rotationX: 0, duration: 1, ease: 'elastic.out(1,0.4)' }));
}

/* ==================== BOOT ==================== */
window.addEventListener('load', () => {
  init3D();
  updatePrice();

  // progress bar and cake turning with the page
  gsap.to('#prog', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  ScrollTrigger.create({
    trigger: '#configurator', start: 'top bottom', end: 'bottom top', scrub: true,
    onUpdate: s => { scrollSpin = s.progress * Math.PI * 0.9; }
  });

  // floating chips
  gsap.to('.chip.tl', { y: -8, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.chip.tr', { y: 8, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.chip.bc', { y: -5, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', xPercent: -50 });

  // entrance
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from('.brand', { opacity: 0, x: -20, duration: 0.8 })
    .fromTo('#headline', { clipPath: 'inset(0 100% 0 0)', filter: 'blur(8px)' },
      { clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)', duration: 1.4, ease: 'power4.inOut' }, 0.1)
    .from('.hero p', { opacity: 0, y: 24, duration: 0.9 }, 0.7)
    .from('.stage', { scale: 0.9, opacity: 0, rotationX: 12, duration: 1.3, ease: 'expo.out' }, 0.35)
    .from('.panel > *', { y: 30, opacity: 0, stagger: 0.1, duration: 0.8 }, 0.55)
    .from('.chip', { scale: 0, stagger: 0.14, duration: 0.7, ease: 'back.out(2)' }, 1.1);

  // section reveals
  gsap.fromTo('#story-h', { clipPath: 'inset(0 0 100% 0)', y: 30 },
    { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: '#story-h', start: 'top 85%' } });
  gsap.from('.feat', { y: 70, opacity: 0, rotationX: -14, stagger: 0.16, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.feats', start: 'top 82%' } });
  gsap.from('.foot > div', { y: 30, opacity: 0, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: 'footer', start: 'top 90%' } });
});