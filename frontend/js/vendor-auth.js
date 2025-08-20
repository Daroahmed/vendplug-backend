console.log("✅ vendor-auth.js loaded");

const BACKEND = window.BACKEND_URL || "";

// Toggle login/register view
document.getElementById("showVendorLoginBtn").addEventListener("click", () => {
  document.getElementById("vendorLoginForm").style.display = "block";
  document.getElementById("vendorRegisterForm").style.display = "none";
});

document.getElementById("showVendorRegisterBtn").addEventListener("click", () => {
  document.getElementById("vendorLoginForm").style.display = "none";
  document.getElementById("vendorRegisterForm").style.display = "block";
});

// 🔐 LOGIN
document.getElementById("vendorLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("vendorLoginEmail").value;
  const password = document.getElementById("vendorLoginPassword").value;

  try {
    const res = await fetch(`${BACKEND}/api/vendors/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Login failed");
      return;
    }

    localStorage.setItem("vendplug-token", data.token);
    localStorage.setItem("vendplugVendor", JSON.stringify(data.vendor));
    window.location.href = "vendor-dashboard.html";

  } catch (err) {
    console.error("❌ Vendor login error:", err);
    alert("Login failed. Try again.");
  }
});

// 📝 REGISTER
document.getElementById("vendorRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("vendorFullName").value;
  const email = document.getElementById("vendorEmail").value;
  const shopName = document.getElementById("vendorShopName").value;
  const phoneNumber = document.getElementById("vendorPhoneNumber").value;
  const password = document.getElementById("vendorPassword").value;
  const businessName = document.getElementById("vendorBusinessName").value;
  const businessAddress = document.getElementById("vendorBusinessAddress").value;
  const cacNumber = document.getElementById("vendorCacNumber").value;
  const category = document.getElementById("vendorCategory").value;
  const state = document.getElementById("vendorState").value;
  const shopDescription = document.getElementById("vendorShopDescription").value;


  const errorMsg = document.getElementById("registerError");

  try {
    const res = await fetch(`${BACKEND}/api/vendors/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName, email, shopName, phoneNumber,
        password, businessName, businessAddress, cacNumber, category,
        state,
        shopDescription
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Vendor registration failed");
    }

    localStorage.setItem("vendplug-token", data.token);
    localStorage.setItem("vendplugVendor", JSON.stringify(data.vendor));
    window.location.href = "vendor-dashboard.html";

  } catch (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
  }
});
