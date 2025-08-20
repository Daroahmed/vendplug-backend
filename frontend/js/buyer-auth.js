console.log("✅ buyer-auth.js loaded");

const BACKEND = window.BACKEND_URL || "";

// Toggle logic (you must have 2 buttons or tabs with IDs below)
document.getElementById("showLoginBtn").addEventListener("click", () => {
  document.getElementById("buyerLoginForm").style.display = "block";
  document.getElementById("buyerRegisterForm").style.display = "none";
});

document.getElementById("showRegisterBtn").addEventListener("click", () => {
  document.getElementById("buyerLoginForm").style.display = "none";
  document.getElementById("buyerRegisterForm").style.display = "block";
});

// 🔐 LOGIN
document.getElementById("buyerLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const messageEl = document.getElementById("loginMessage");

  try {
    const res = await fetch(`${BACKEND}/api/buyers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem("vendplug-token", data.token);
      localStorage.setItem("vendplugBuyer", JSON.stringify(data));
      messageEl.textContent = "Login successful!";
      messageEl.style.color = "green";
      setTimeout(() => (window.location.href = "buyer-home.html"), 1000);
    } else {
      messageEl.textContent = data.message || "Login failed.";
      messageEl.style.color = "red";
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    messageEl.textContent = "Error logging in.";
    messageEl.style.color = "red";
  }
});

// 📝 REGISTER
document.getElementById("buyerRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("registerFullName").value;
  const email = document.getElementById("registerEmail").value;
  const phoneNumber = document.getElementById("registerPhone").value;
  const password = document.getElementById("registerPassword").value;
  const messageEl = document.getElementById("registerMessage");

  try {
    const res = await fetch(`${BACKEND}/api/buyers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phoneNumber, password }),
    });

    const data = await res.json();

    if (res.status === 201) {
      messageEl.textContent = "Registration successful!";
      messageEl.style.color = "green";
      setTimeout(() => (window.location.href = "buyer-home.html"), 1000);
    } else {
      messageEl.textContent = data.message || "Registration failed.";
      messageEl.style.color = "red";
    }
  } catch (err) {
    console.error("❌ Registration error:", err);
    messageEl.textContent = "Error registering.";
    messageEl.style.color = "red";
  }
});
