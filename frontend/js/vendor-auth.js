console.log("✅ vendor-auth.js loaded");

const BACKEND = window.BACKEND_URL || "";

// Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", () => {
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
  showLoading && showLoading();
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

    localStorage.setItem("vendplug-vendor-token", data.token);
    // Remove token from vendor object before storing
    const vendorData = { ...data.vendor };
    delete vendorData.token; // Remove token from user object
    localStorage.setItem("vendplugVendor", JSON.stringify(vendorData));
    
    // Clean up conflicting tokens after successful vendor login
    if (typeof cleanupAfterLogin === 'function') {
      cleanupAfterLogin('vendor');
    }
    
    window.location.href = "vendor-dashboard.html";

  } catch (err) {
    console.error("❌ Vendor login error:", err);
    alert("Login failed. Try again.");
  } finally { hideLoading && hideLoading(); }
  });

  // 📝 REGISTER
  document.getElementById("vendorRegisterForm").addEventListener("submit", async (e) => {
  console.log("🚀 Registration form submitted!");
  e.preventDefault();
  showLoading && showLoading();

  const fullName = document.getElementById("vendorFullName").value;
  const email = document.getElementById("vendorEmail").value;
  const shopName = document.getElementById("vendorShopName").value;
  const phoneNumber = document.getElementById("vendorPhoneNumber").value;
  const password = document.getElementById("vendorPassword").value;
  const businessName = document.getElementById("vendorBusinessName").value;
  const businessAddress = document.getElementById("vendorBusinessAddress").value;
  const cacNumber = document.getElementById("vendorCacNumber").value;

    // Collect multiple selected categories
    const categorySelect = document.getElementById("category");
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(opt => opt.value);
  
    // Handle "Other" category properly
    const otherCategoryInput = document.getElementById("otherCategory").value.trim();
    let finalCategories = selectedCategories;
    let otherCategory = null;
  
    if (selectedCategories.includes("Other") && otherCategoryInput) {
      // Keep "Other" in the categories array, send custom category separately
      otherCategory = otherCategoryInput;
    }
  
  const state = document.getElementById("vendorState").value;
  const shopDescription = document.getElementById("vendorShopDescription").value;


  const errorMsg = document.getElementById("registerError");

  try {
    const res = await fetch(`${BACKEND}/api/vendors/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName, email, shopName, phoneNumber,
        password, businessName, businessAddress, cacNumber, category: finalCategories,
        otherCategory,
        state,
        shopDescription
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Vendor registration failed");
    }

    // Store email for verification
    localStorage.setItem('pendingVerificationEmail', email);
    localStorage.setItem('pendingVerificationRole', 'vendor');

    // Send verification email
    try {
              const verifyRes = await fetch(`${BACKEND}/api/auth/send-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, userType: 'vendor' })
        });

      if (verifyRes.ok) {
        alert("Registration successful! Please check your email to verify your account.");
        window.location.href = "verify-email.html";
      } else {
        alert("Registration successful but couldn't send verification email. Please try again.");
      }
    } catch (verifyErr) {
      console.error("❌ Verification email error:", verifyErr);
      alert("Registration successful but couldn't send verification email. Please try again.");
    }

  } catch (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = "block";
  } finally { hideLoading && hideLoading(); }
  });

  // 🔄 Show "Other Category" input when "Other" is selected
  document.getElementById("category").addEventListener("change", function() {
    const otherDiv = document.getElementById("otherCategoryDiv");
    if (this.value === "Other") {
      otherDiv.style.display = "block";
    } else {
      otherDiv.style.display = "none";
      document.getElementById("otherCategory").value = ""; // reset if not needed
    }
  });
});

