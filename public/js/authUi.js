import { auth, onAuthStateChanged, getIdToken as getToken } from "./firebaseClient.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const LOGIN_CONTAINER_ID = "auth-ui-container";
const APP_SHELL_SELECTOR = ".app-shell";

const buildLoginUi = () => {
  const container = document.createElement("div");
  container.id = LOGIN_CONTAINER_ID;
  container.style.cssText = "position: fixed; inset: 0; background: rgba(2, 6, 23, 0.88); display: flex; align-items: center; justify-content: center; z-index: 10000;";

  const panel = document.createElement("div");
  panel.style.cssText = "width: min(360px, 92vw); background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 18px; padding: 22px; color: #e5e7eb; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.9);";

  panel.innerHTML = `
    <div style="font-size: 16px; font-weight: 600; margin-bottom: 6px;">Admin Login</div>
    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">Sign in to access the GA Gutter Guys admin portal.</div>
    <div style="display: grid; gap: 10px;">
      <input id="auth-email" type="email" placeholder="Email" style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.98); color: #e5e7eb;" />
      <input id="auth-password" type="password" placeholder="Password" style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.98); color: #e5e7eb;" />
      <button id="auth-login-btn" type="button" style="padding: 10px 14px; border-radius: 999px; border: none; background: linear-gradient(135deg, #22d3ee, #0ea5e9); color: #0b1120; font-weight: 600; cursor: pointer;">Sign In</button>
      <div id="auth-error" style="font-size: 11px; color: #fca5a5; min-height: 16px;"></div>
    </div>
  `;

  container.appendChild(panel);
  document.body.appendChild(container);

  const loginBtn = panel.querySelector("#auth-login-btn");
  const emailInput = panel.querySelector("#auth-email");
  const passwordInput = panel.querySelector("#auth-password");
  const errorEl = panel.querySelector("#auth-error");

  if (loginBtn && emailInput && passwordInput) {
    loginBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) {
        errorEl.textContent = "Email and password are required.";
        return;
      }

      try {
        errorEl.textContent = "";
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        errorEl.textContent = error && error.message ? error.message : "Login failed.";
      }
    });
  }

  return container;
};

const updateUserPill = (user) => {
  const initialsEl = document.getElementById("user-initials");
  const labelEl = document.getElementById("user-label");

  if (labelEl) {
    labelEl.textContent = user
      ? `${user.email || "User"} · Role: Admin`
      : "Signed out";
  }

  if (initialsEl) {
    const email = user?.email || "";
    const initials = email ? email.slice(0, 2).toUpperCase() : "--";
    initialsEl.textContent = initials;
  }
};

const toggleAppShell = (isAuthenticated) => {
  const appShell = document.querySelector(APP_SHELL_SELECTOR);
  if (appShell) {
    appShell.style.display = isAuthenticated ? "block" : "none";
  }

  const existingLogin = document.getElementById(LOGIN_CONTAINER_ID);
  if (isAuthenticated) {
    if (existingLogin) existingLogin.remove();
  } else if (!existingLogin) {
    buildLoginUi();
  }
};

const wireLogout = () => {
  const navActions = document.querySelector(".nav-actions");
  if (navActions && !document.getElementById("auth-logout-btn")) {
    const btn = document.createElement("button");
    btn.id = "auth-logout-btn";
    btn.type = "button";
    btn.className = "ghost-btn";
    btn.textContent = "Logout";
    navActions.insertBefore(btn, navActions.firstChild);
  }

  const logoutBtn = document.getElementById("auth-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut(auth));
  }
};

export const initAuthUi = () => {
  onAuthStateChanged((user) => {
    toggleAppShell(Boolean(user));
    updateUserPill(user);
    wireLogout();
  });
};

export const getIdToken = async () => {
  return getToken();
};

window.addEventListener("DOMContentLoaded", () => {
  initAuthUi();
});
