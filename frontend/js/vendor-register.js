document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("vendor-register-form");
  const errorMsg = document.getElementById("register-error");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const shopName = document.getElementById("shopName").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const password = document.getElementById("password").value.trim();
    const businessName = document.getElementById("businessName").value.trim();
    const businessAddress = document.getElementById("businessAddress").value.trim();
    const cacNumber = document.getElementById("cacNumber").value.trim();

    const registerData = {
      fullName,
      email,
      shopName,
      phoneNumber,
      password,
      businessName,
      businessAddress,
      cacNumber
    };

    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(registerData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Save token and vendor data to localStorage
      localStorage.setItem("vendplug-token", data.token);
      localStorage.setItem("vendplugVendor", JSON.stringify(data.vendor));

      // Redirect to vendor dashboard or home
      window.location.href = "/vendor-dashboard.html";

    } catch (error) {
      errorMsg.textContent = error.message;
      errorMsg.style.display = "block";
    }
  });
});
