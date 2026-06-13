const portals = [
  // 새 웹을 추가하거나 주소를 바꿀 때는 이 목록만 수정하면 됩니다.
  { name: "티비 게시판", icon: "assets/icons/notice.svg", url: "https://class-2-dashboard.web.app/admin.html", x: 50, y: 14, color: "#eaf5ff" },
  { name: "출결 관리", icon: "assets/icons/attendance.svg", url: "https://studentawttendence.netlify.app/", x: 79, y: 39, color: "#7bdcff" },
  { name: "자료 관리", icon: "assets/icons/library.svg", url: "#", x: 68, y: 76, color: "#ffe39a" },
  { name: "일정 관리", icon: "assets/icons/calendar.svg", url: "#", x: 32, y: 76, color: "#ff92d6" },
  { name: "학생 명단", icon: "assets/icons/students.svg", url: "#", x: 21, y: 39, color: "#9affc7" },
];

const nodeRoot = document.querySelector("#service-nodes");
const lineRoot = document.querySelector("#network-lines");
const portalCount = document.querySelector("#portal-count");
const root = document.documentElement;
const hub = document.querySelector(".orbital-hub");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const accessGate = document.querySelector("#access-gate");
const accessForm = document.querySelector("#access-form");
const accessInput = document.querySelector("#access-code");
const accessError = document.querySelector("#access-error");
const launchFlash = document.querySelector("#launch-flash");
const ACCESS_CODE = "2726";
let spin = 0;
let spinVelocity = 0;
let tiltX = -8;
let tiltY = 10;
let targetTiltX = tiltX;
let targetTiltY = tiltY;
let touchStartX = 0;
let touchStartY = 0;
let parallaxX = 0;
let parallaxY = 0;
let targetParallaxX = 0;
let targetParallaxY = 0;

function setAppHeight() {
  root.style.setProperty("--app-height", `${window.innerHeight}px`);
  document.body.dataset.orientation =
    window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

function updateHubTransform() {
  root.style.setProperty("--spin", `${spin.toFixed(2)}deg`);
  root.style.setProperty("--counter-spin", `${(-spin).toFixed(2)}deg`);
  root.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
  root.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
}

function animateHub() {
  if (prefersReducedMotion) {
    updateHubTransform();
    return;
  }

  spin += spinVelocity;
  spinVelocity *= 0.92;
  if (Math.abs(spinVelocity) < 0.001) spinVelocity = 0;
  tiltX += (targetTiltX - tiltX) * 0.08;
  tiltY += (targetTiltY - tiltY) * 0.08;
  updateHubTransform();
  requestAnimationFrame(animateHub);
}

function rotateHub(delta) {
  spinVelocity += delta;
  spinVelocity = Math.max(-4.5, Math.min(4.5, spinVelocity));
  updateHubTransform();
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
    const isPlaceholder = portal.url === "#";
    event.preventDefault();
    node.classList.remove("is-launching");
    void node.offsetWidth;
    node.classList.add("is-launching");

    const rect = node.getBoundingClientRect();
    launchFlash.style.setProperty("--launch-x", `${rect.left + rect.width / 2}px`);
    launchFlash.style.setProperty("--launch-y", `${rect.top + rect.height / 2}px`);
    launchFlash.classList.remove("is-active");
    void launchFlash.offsetWidth;
    launchFlash.classList.add("is-active");

    if (!isPlaceholder) {
      window.setTimeout(() => {
        window.location.href = portal.url;
      }, prefersReducedMotion ? 0 : 430);
    }
  });
  nodeRoot.appendChild(node);
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
  parallaxX += (targetParallaxX - parallaxX) * 0.04;
  parallaxY += (targetParallaxY - parallaxY) * 0.04;

  for (const star of stars) {
    if (!prefersReducedMotion) {
      star.y += star.drift;
      if (star.y > height + 8) star.y = -8;
    }

    const x = star.x + parallaxX * star.z;
    const y = star.y + parallaxY * star.z;
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

window.addEventListener(
  "wheel",
  (event) => {
    rotateHub(event.deltaY * 0.018);
  },
  { passive: true },
);

window.addEventListener(
  "pointermove",
  (event) => {
    if (!hub || window.matchMedia("(pointer: coarse)").matches) return;
    const rect = hub.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    targetTiltX = Math.max(-18, Math.min(18, -8 - y * 18));
    targetTiltY = Math.max(-22, Math.min(22, 10 + x * 22));
    targetParallaxX = (event.clientX / window.innerWidth - 0.5) * 34;
    targetParallaxY = (event.clientY / window.innerHeight - 0.5) * 26;
  },
  { passive: true },
);

window.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  },
  { passive: true },
);

window.addEventListener(
  "touchmove",
  (event) => {
    const touch = event.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    rotateHub(dx * 0.014 + dy * 0.007);
    targetTiltX = Math.max(-18, Math.min(18, -8 - dy * 0.04));
    targetTiltY = Math.max(-22, Math.min(22, 10 + dx * 0.05));
    targetParallaxX = (touch.clientX / window.innerWidth - 0.5) * 30;
    targetParallaxY = (touch.clientY / window.innerHeight - 0.5) * 24;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  },
  { passive: true },
);

window.addEventListener(
  "deviceorientation",
  (event) => {
    if (event.beta === null || event.gamma === null) return;
    targetTiltX = Math.max(-16, Math.min(16, -8 + event.beta * 0.18));
    targetTiltY = Math.max(-20, Math.min(20, 10 + event.gamma * 0.32));
    targetParallaxX = Math.max(-28, Math.min(28, event.gamma * 1.2));
    targetParallaxY = Math.max(-22, Math.min(22, event.beta * 0.4));
  },
  { passive: true },
);
