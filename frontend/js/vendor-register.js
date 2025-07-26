document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("vendorRegisterForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const shopName = document.getElementById("shopName").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const password = document.getElementById("password").value.trim();
    const businessName = document.getElementById("businessName").value.trim();
    const businessAddress = document.getElementById("businessAddress").value.trim();
    const cacNumber = document.getElementById("cacNumber").value.trim();

    const data = {
      fullName,
      email,
      shopName,
      phoneNumber,
      password,
      businessName,
      businessAddress,
      cacNumber,
    };

    try {
      const res = await fetch(`${baseURL}/api/vendors/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.message || "Vendor registration failed.");
        return;
      }

      // Save token and vendor info
      localStorage.setItem("vendplug-token", result.token);
      localStorage.setItem("vendplugAgent", JSON.stringify(result.vendor));

      alert("Registration successful!");
      window.location.href = "agent-dashboard.html"; // Or your target dashboard
    } catch (err) {
      console.error("❌ Registration Error:", err);
      alert("Something went wrong. Please try again.");
    }
  });
});
