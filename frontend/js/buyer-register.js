console.log("BACKEND_URL is:", BACKEND_URL);
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("buyerRegisterForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const phoneNumber = document.getElementById("phone").value;
    
    const password = document.getElementById("password").value;

    const messageEl = document.getElementById("message");

    try {
      const res = await fetch(`${BACKEND_URL}/api/buyers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phoneNumber, password })
      });

      const data = await res.json();
      messageEl.textContent = data.message;

      if (res.status === 201) {
        messageEl.style.color = 'green';
        setTimeout(() => (window.location.href = "/buyer-login.html"), 1000);
      } else {
        messageEl.style.color = 'red';
      }
    } catch (err) {
      console.error("Registration error:", err);
      messageEl.textContent = "Server error. Please try again.";
      messageEl.style.color = "red";
    }
  });
});
