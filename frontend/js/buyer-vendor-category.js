document.addEventListener('DOMContentLoaded', () => {
  const states = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ];

  const categories = [
    { name: 'Electronics', image: '/assets/electronics.jpg' },
    { name: 'Fashion', image: '/assets/fashion.jpg' },
    { name: 'Groceries', image: '/assets/groceries.jpg' },
    { name: 'Meat & Poultry', image: '/assets/meat.jpg' },
    { name: 'Phones & Accessories', image: '/assets/phones.jpg' },
    { name: 'Health & Beauty', image: '/assets/beauty.jpg' },
    { name: 'Home & Kitchen', image: '/assets/kitchen.jpg' },
  ];

  const stateSelect = document.getElementById('stateSelect');
  const categoryGrid = document.getElementById('categoryGrid');
  const categorySection = document.getElementById('categorySection');

  // 👉 Populate state dropdown
  states.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    if (state === 'FCT') option.selected = true; // ✅ Default to FCT
    stateSelect.appendChild(option);
  });

  // Show categories on load if default state is set
  categorySection.style.display = 'block';
  categorySection.scrollIntoView({ behavior: 'smooth' });

  // 👂 Handle state change (still scroll and show categories)
  stateSelect.addEventListener('change', () => {
    if (stateSelect.value) {
      categorySection.style.display = 'block';
      categorySection.scrollIntoView({ behavior: 'smooth' });
    } else {
      categorySection.style.display = 'none';
    }
  });

  // 📦 Render category cards
  categories.forEach(category => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <img src="${category.image}" alt="${category.name}" />
      <strong>${category.name}</strong>
    `;

    // 🔁 Handle click on category
    card.addEventListener('click', () => {
      const selectedState = stateSelect.value;
      if (!selectedState) {
        alert('Please select a state first.');
        return;
      }

      const query = new URLSearchParams({
        state: selectedState,
        category: category.name
      }).toString();

      window.location.href = `/vendor-shop.html?${query}`;
    });

    categoryGrid.appendChild(card);
  });
});
