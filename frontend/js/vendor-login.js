document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("vendorLoginForm");
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
  
      try {
        const res = await fetch("/api/vendors/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });
  
        const data = await res.json();
  
        if (!res.ok) {
          alert(data.message || "Login failed");
          return;
        }
        
        if (!data.vendor || !data.token) {
          console.error("❌ Missing vendor or token in response:", data);
          alert("Login failed: Missing vendor information.");
          return;
        }
        
        alert("✅ Login successful!");
        localStorage.setItem("vendplug-token", data.token);
        localStorage.setItem("vendplugVendor", JSON.stringify(data.vendor));
        window.location.href = "vendor-dashboard.html";
        
      } catch (err) {
        console.error("❌ Login error:", err);
        alert("Failed to log in. Please try again.");
      }
    });
  });
  