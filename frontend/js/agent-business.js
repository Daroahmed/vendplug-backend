document.addEventListener("DOMContentLoaded", () => {
    const agentGrid = document.getElementById("agentGrid");
    const loadingSpinner = document.getElementById("loadingSpinner");
  
    const BACKEND_URL = "/api"; // Change this if your API base is different
  
    // ✅ Get state & category from URL first, then localStorage, then default
    const urlParams = new URLSearchParams(window.location.search);
    let state = urlParams.get("state") || localStorage.getItem("vendplug-buyer-state") || "FCT";
    let category = urlParams.get("category") || localStorage.getItem("vendplug-category") || "Groceries";
  
    // ✅ Save to localStorage so future visits remember choice
    localStorage.setItem("vendplug-buyer-state", state);
    localStorage.setItem("vendplug-category", category);
  
    console.log(`📍 State: ${state}, 📦 Category: ${category}`);
  
    // ✅ Fetch agents
    async function fetchAgents() {
      try {
        loadingSpinner.style.display = "block";
        agentGrid.innerHTML = "";
  
        const res = await fetch(
          `${BACKEND_URL}/agents/shop-agents?state=${encodeURIComponent(state)}&category=${encodeURIComponent(category)}`
        );
        const data = await res.json();
  
        if (!res.ok) {
          throw new Error(data.message || "Failed to fetch agents");
        }
  
        if (!data.agents || data.agents.length === 0) {
          agentGrid.innerHTML = `<p class="no-results">No agents found for ${category} in ${state}.</p>`;
          return;
        }
  
        renderAgents(data.agents);
  
      } catch (err) {
        console.error("❌ Error fetching agents:", err);
        agentGrid.innerHTML = `<p class="error">Error loading agents. Please try again later.</p>`;
      } finally {
        loadingSpinner.style.display = "none";
      }
    }
  
    // ✅ Render agents in grid
    function renderAgents(agents) {
      agentGrid.innerHTML = agents.map(agent => `
        <div class="agent-card">
          <img src="${agent.image || '/assets/default-agent.jpg'}" alt="${agent.businessName}" />
          <h3>${agent.businessName}</h3>
          <p>${agent.state}</p>
          <p>${agent.category}</p>
          <button onclick="viewAgent('${agent._id}')">View Business</button>
        </div>
      `).join("");
    }
  
    // ✅ Redirect to agents page
    window.viewAgent = (agentId) => {
      window.location.href = `/agent-details.html?id=${agentId}`;
    };
  
    // 🔄 Initial fetch
    fetchAgents();
  });
  