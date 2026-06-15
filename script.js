const portals = [
  // 새 웹을 추가하거나 주소를 바꿀 때는 이 목록만 수정하면 됩니다.
  { name: "티비 게시판", icon: "assets/icons/notice.svg", url: "https://class-2-dashboard.web.app/admin.html", x: 50, y: 14, color: "#eaf5ff" },
  { name: "출결 관리", icon: "assets/icons/attendance.svg", url: "https://student-attendence-sand.vercel.app/", x: 79, y: 39, color: "#7bdcff" },
  { name: "자료 관리", icon: "assets/icons/library.svg", url: "https://drive.google.com/drive/folders/1Kv6vz_45Xgp2Oko9m0hgVZzodfevVK8Q?usp=sharing", x: 68, y: 76, color: "#ffe39a" },
  { name: "일정 관리", icon: "assets/icons/calendar.svg", url: "#", x: 32, y: 76, color: "#ff92d6" },
  { name: "학생 명단", icon: "assets/icons/students.svg", url: "#", x: 21, y: 39, color: "#9affc7" },
];

const nodeRoot = document.querySelector("#service-nodes");
const lineRoot = document.querySelector("#network-lines");
const portalCount = document.querySelector("#portal-count");
const root = document.documentElement;
const hub = document.querySelector(".orbital-hub");
const hubStage = document.querySelector(".hub-stage");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const accessGate = document.querySelector("#access-gate");
const accessForm = document.querySelector("#access-form");
const accessInput = document.querySelector("#access-code");
const accessError = document.querySelector("#access-error");
const launchFlash = document.querySelector("#launch-flash");
const navPortalLinks = document.querySelectorAll("[data-portal-nav]");
const ACCESS_CODE = "2726";
let spin = 0;
let spinVelocity = 0;
let isPointerDragging = false;
let pointerMoved = false;
let lastDialAngle = 0;
let totalDialMovement = 0;
let activeTouchId = null;

function setAppHeight() {
  const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
  const isLandscape = viewportWidth > viewportHeight;
  let hubSize = isLandscape
    ? Math.min(viewportWidth * 0.46, viewportHeight * 0.66, 560)
    : Math.min(viewportWidth * 0.9, viewportHeight * 0.5, 600);

  if (viewportHeight < 620) {
    hubSize = Math.min(hubSize, viewportHeight * 0.58, viewportWidth * 0.44);
  }

  root.style.setProperty("--app-height", `${viewportHeight}px`);
  root.style.setProperty("--hub-size", `${Math.max(220, Math.round(hubSize))}px`);
  document.body.dataset.orientation = isLandscape ? "landscape" : "portrait";
}

function updateHubTransform() {
  root.style.setProperty("--spin", `${spin.toFixed(2)}deg`);
  root.style.setProperty("--counter-spin", `${(-spin).toFixed(2)}deg`);
}

function animateHub() {
  if (prefersReducedMotion) {
    updateHubTransform();
    return;
  }

  spin += spinVelocity;
  spinVelocity *= 0.86;
  if (Math.abs(spinVelocity) < 0.001) spinVelocity = 0;
  updateHubTransform();
  requestAnimationFrame(animateHub);
}

function rotateHub(delta) {
  spinVelocity += delta;
  spinVelocity = Math.max(-4.8, Math.min(4.8, spinVelocity));
  updateHubTransform();
}

function getDialAngle(clientX, clientY) {
  const rect = hub.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
}

function normalizeAngleDelta(delta) {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

function turnDialTo(clientX, clientY) {
  const nextAngle = getDialAngle(clientX, clientY);
  const delta = normalizeAngleDelta(nextAngle - lastDialAngle);
  spin += delta * 0.9;
  spinVelocity = 0;
  totalDialMovement += Math.abs(delta);
  pointerMoved = totalDialMovement > 5;
  lastDialAngle = nextAngle;
  updateHubTransform();
}

function beginDial(clientX, clientY) {
  isPointerDragging = true;
  pointerMoved = false;
  totalDialMovement = 0;
  spinVelocity = 0;
  lastDialAngle = getDialAngle(clientX, clientY);
}

function endDial() {
  const shouldSuppressClick = pointerMoved;
  isPointerDragging = false;
  activeTouchId = null;
  window.setTimeout(() => {
    pointerMoved = false;
  }, shouldSuppressClick ? 360 : 80);
}

setAppHeight();
updateHubTransform();
animateHub();

function unlockHub() {
  accessGate.classList.add("is-opening");
  document.body.classList.remove("locked");
  document.body.classList.add("hub-ready");
  sessionStorage.setItem("classHubUnlocked", "true");
  window.setTimeout(() => {
    accessGate.classList.add("is-unlocked");
  }, prefersReducedMotion ? 0 : 680);
}

document.body.classList.add("locked");

if (sessionStorage.getItem("classHubUnlocked") === "true") {
  accessGate.classList.add("is-unlocked");
  unlockHub();
}

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (accessInput.value === ACCESS_CODE) {
    unlockHub();
    return;
  }

  accessError.textContent = "입장 코드가 맞지 않습니다.";
  accessInput.value = "";
  accessInput.focus();
});

function launchPortal(portal, sourceElement) {
  const hasUrl = portal.url && portal.url !== "#";
  sourceElement.classList.remove("is-launching");
  void sourceElement.offsetWidth;
  sourceElement.classList.add("is-launching");

  const rect = sourceElement.getBoundingClientRect();
  launchFlash.style.setProperty("--launch-x", `${rect.left + rect.width / 2}px`);
  launchFlash.style.setProperty("--launch-y", `${rect.top + rect.height / 2}px`);
  launchFlash.classList.remove("is-active");
  void launchFlash.offsetWidth;
  launchFlash.classList.add("is-active");

  if (hasUrl) {
    const destination = portal.url;
    window.setTimeout(() => {
      window.location.assign(destination);
    }, prefersReducedMotion ? 0 : 140);
  }
}

portals.forEach((portal, index) => {
  const node = document.createElement("a");
  node.className = "service-node";
  node.href = portal.url;
  node.style.setProperty("--x", portal.x);
  node.style.setProperty("--y", portal.y);
  node.style.setProperty("--node-color", portal.color);
  node.style.setProperty("--depth", `${((index % 5) - 2) * 0.55}rem`);
  node.style.animationDelay = `${index * -0.22}s`;
  node.setAttribute("aria-label", `${portal.name} 바로가기`);
  node.innerHTML = `
    <span class="service-visual">
      <span class="service-icon"><img src="${portal.icon}" alt="" /></span>
      <span class="service-label">${portal.name}</span>
    </span>
  `;
  node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pointerMoved) return;
    launchPortal(portal, node);
  });
  nodeRoot.appendChild(node);
});

navPortalLinks.forEach((link) => {
  const portal = portals[Number(link.dataset.portalNav)];
  if (!portal) return;

  link.href = portal.url;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    launchPortal(portal, link);
  });
});

portalCount.textContent = portals.length;

const links = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
  [0, 2],
  [1, 3],
];

links.forEach(([fromIndex, toIndex]) => {
  const from = portals[fromIndex];
  const to = portals[toIndex];
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", from.x * 6.2);
  line.setAttribute("y1", from.y * 6.2);
  line.setAttribute("x2", to.x * 6.2);
  line.setAttribute("y2", to.y * 6.2);
  lineRoot.appendChild(line);
});

const canvas = document.querySelector("#neural-bg");
const ctx = canvas.getContext("2d");
const points = [];
const stars = [];
let width = 0;
let height = 0;
let frame = 0;

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  points.length = 0;
  stars.length = 0;
  const count = Math.max(22, Math.round((width * height) / 44000));
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 2 + Math.random() * 3.8,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      hue: Math.random() > 0.52 ? 194 : 286,
    });
  }

  const starCount = Math.max(70, Math.round((width * height) / 9000));
  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z: 0.25 + Math.random() * 1.2,
      r: 0.35 + Math.random() * 1.25,
      alpha: 0.28 + Math.random() * 0.58,
      drift: 0.04 + Math.random() * 0.08,
    });
  }
}

function drawStars() {
  for (const star of stars) {
    if (!prefersReducedMotion) {
      star.y += star.drift;
      if (star.y > height + 8) star.y = -8;
    }

    const x = star.x;
    const y = star.y;
    ctx.fillStyle = `rgba(236, 247, 255, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNeuron(point) {
  const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 34);
  gradient.addColorStop(0, `hsla(${point.hue}, 100%, 72%, 0.72)`);
  gradient.addColorStop(0.18, `hsla(${point.hue}, 100%, 66%, 0.28)`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${point.hue}, 100%, 76%, 0.86)`;
  ctx.beginPath();
  ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  frame += 1;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(2, 5, 13, 0.72)";
  ctx.fillRect(0, 0, width, height);
  drawStars();

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!prefersReducedMotion) {
      point.x += point.vx;
      point.y += point.vy;
    }

    if (point.x < -40) point.x = width + 40;
    if (point.x > width + 40) point.x = -40;
    if (point.y < -40) point.y = height + 40;
    if (point.y > height + 40) point.y = -40;

    for (let j = i + 1; j < points.length; j += 1) {
      const other = points[j];
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      const distance = Math.hypot(dx, dy);
      const reach = Math.min(300, Math.max(190, width * 0.18));

      if (distance < reach) {
        const alpha = (1 - distance / reach) * 0.36;
        ctx.strokeStyle = `rgba(145, 190, 255, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        const curve = Math.sin((frame + i * 11 + j * 7) * 0.012) * 18;
        ctx.quadraticCurveTo(
          (point.x + other.x) / 2 + curve,
          (point.y + other.y) / 2 - curve,
          other.x,
          other.y,
        );
        ctx.stroke();
      }
    }

    drawNeuron(point);
  }

  if (!prefersReducedMotion) {
    requestAnimationFrame(draw);
  }
}

resizeCanvas();
draw();

window.addEventListener("resize", () => {
  setAppHeight();
  resizeCanvas();
});

window.visualViewport?.addEventListener("resize", () => {
  setAppHeight();
  resizeCanvas();
});

function stopSafariPageDrag(event) {
  if (event.cancelable) event.preventDefault();
}

document.addEventListener("touchmove", stopSafariPageDrag, {
  capture: true,
  passive: false,
});

window.addEventListener("touchmove", stopSafariPageDrag, {
  capture: true,
  passive: false,
});

window.addEventListener("gesturestart", stopSafariPageDrag, {
  passive: false,
});

window.addEventListener("gesturechange", stopSafariPageDrag, {
  passive: false,
});

window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    rotateHub(event.deltaY * 0.025);
  },
  { passive: false },
);

hubStage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "pen") return;
  if (event.target.closest(".service-node")) return;
  beginDial(event.clientX, event.clientY);
  hubStage.setPointerCapture(event.pointerId);
});

hubStage.addEventListener("pointerup", (event) => {
  if (!isPointerDragging) return;
  endDial();
  hubStage.releasePointerCapture(event.pointerId);
});

hubStage.addEventListener("pointercancel", () => {
  endDial();
});

window.addEventListener(
  "pointermove",
  (event) => {
    if (!isPointerDragging || event.pointerType !== "pen") return;
    turnDialTo(event.clientX, event.clientY);
  },
  { passive: true },
);

hubStage.addEventListener(
  "touchstart",
  (event) => {
    if (event.target.closest(".service-node")) return;
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches[0];
    activeTouchId = touch.identifier;
    beginDial(touch.clientX, touch.clientY);
  },
  { passive: false },
);

hubStage.addEventListener(
  "touchmove",
  (event) => {
    if (event.cancelable) event.preventDefault();
    if (!isPointerDragging) return;
    const touch = Array.from(event.changedTouches).find(
      (candidate) => candidate.identifier === activeTouchId,
    );
    if (!touch) return;
    turnDialTo(touch.clientX, touch.clientY);
  },
  { passive: false },
);

hubStage.addEventListener(
  "touchend",
  (event) => {
    const touchEnded = Array.from(event.changedTouches).some(
      (candidate) => candidate.identifier === activeTouchId,
    );
    if (touchEnded) endDial();
  },
  { passive: true },
);

hubStage.addEventListener(
  "touchcancel",
  () => {
    endDial();
  },
  { passive: true },
);
