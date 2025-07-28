document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${window.BACKEND_URL}/api/agents/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok) {
      console.log("✅ Agent login response:", data);

      // Save all required session items
      localStorage.setItem("vendplug-token", data.token);
      if (data.agent && data.agent._id) {
        localStorage.setItem("vendplugAgent", JSON.stringify(data.agent));
        localStorage.setItem("vendplug-token", data.token);
        localStorage.setItem("role", data.agent.role);
        localStorage.setItem("name", data.agent.fullName);
      
        setTimeout(() => {
          window.location.href = "agent-dashboard.html";
        }, 100);
      } else {
        alert("Agent data missing in response. Please contact support.");
      }
      
    } else {
      alert(data.message || "Login failed");
    }
  } catch (error) {
    alert("An error occurred. Please try again.");
    console.error(error);
  }
});
