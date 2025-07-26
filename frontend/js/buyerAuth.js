// js/buyer-auth.js

const baseUrl = "/api/buyers";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      try {
        const res = await fetch(`${baseUrl}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) return alert(data.message || "Login failed");

        localStorage.setItem("vendplug-token", data.token);
        localStorage.setItem("buyer", JSON.stringify(data.user));
        location.href = "buyer-dashboard.html";
      } catch (err) {
        alert("Error logging in");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async e => {
      e.preventDefault();
      const fullName = document.getElementById("fullName").value.trim();
      const email = document.getElementById("email").value.trim();
      const phoneNumber = document.getElementById("phoneNumber").value.trim();
      const password = document.getElementById("password").value.trim();

      try {
        const res = await fetch(`${baseUrl}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email, password, phoneNumber })
        });

        const data = await res.json();
        if (!res.ok) return alert(data.message || "Registration failed");

        alert("Registration successful. Please log in.");
        location.href = "buyer-login.html";
      } catch (err) {
        alert("Error during registration");
      }
    });
  }
});
