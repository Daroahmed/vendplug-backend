document.addEventListener('DOMContentLoaded', () => {
  const states = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ];

  const categories = [
    // 🛒 Everyday Essentials
    { name: "Supermarkets/Groceries and Provisions", image: "/assets/groceries.jpg" },
    { name: "Soft Drinks & Water", image: "/assets/soft-drinks.jpg" },
    { name: "Kitchen Utensils & Plastics", image: "/assets/kitchen-utensils.jpg" },
    { name: "Gas Plants", image: "/assets/gas.jpg" },
    { name: "Fruits & Vegetables", image: "/assets/fruits-vegetables.jpg" },
    { name: "Grains", image: "/assets/grains.jpg" },
  
    // 🍖 Meat & Animal Products
    { name: "Suya & Balango", image: "/assets/suya.jpg" },
    { name: "Raw Meat Sellers", image: "/assets/meat.jpg" },
    { name: "Poultry (Chicken, Eggs, Turkey)", image: "/assets/poultry.jpg" },
    { name: "Livestock (Goat, Ram, Cow)", image: "/assets/livestock.jpg" },
    { name: "Fish & Seafood", image: "/assets/fish.jpg" },
  
    // 🍽️ Food & Hospitality
    { name: "Restaurants", image: "/assets/restaurants.jpg" },
    { name: "Catering & Small Chops", image: "/assets/catering.jpg" },
    { name: "Hotels & Apartments", image: "/assets/hotels.jpg" },
    { name: "Event Rentals (Canopies, Chairs)", image: "/assets/event-rentals.jpg" },
  
    // 👚 Fashion & Lifestyle
    { name: "Boutiques", image: "/assets/boutiques.jpg" },
    { name: "Thrift / Okrika / Gongo", image: "/assets/thrift.jpg" },
    { name: "Tokunbo / Belguim Products", image: "/assets/tokunbo.jpg" },
    { name: "Shoes and Bags", image: "/assets/shoes-bags.jpg" },
    { name: "Jewelry & Accessories", image: "/assets/jewelry.jpg" },
    { name: "Tailoring & Fashion Design", image: "/assets/tailoring.jpg" },
    { name: "Textiles & Fabrics", image: "/assets/textiles.jpg" },
    { name: "Wigs & Hair", image: "/assets/wigs.jpg" },
    { name: "Cosmetics & Skincare", image: "/assets/cosmetics.jpg" },
    { name: "Perfumes & Fragrances", image: "/assets/perfumes.jpg" },
    { name: "Nigerian Caps e.g. Zana", image: "/assets/caps.jpg" },
  
    // 🏠 Home & Living
    { name: "Furniture", image: "/assets/furniture.jpg" },
    { name: "Home Appliances", image: "/assets/home-appliances.jpg" },
    { name: "Interior Decor & Curtains", image: "/assets/interior.jpg" },
    { name: "Cleaning Services", image: "/assets/cleaning.jpg" },
    { name: "Flowers & Gardens", image: "/assets/flowers.jpg" },
  
    // 🧱 Building & Construction
    { name: "Building Materials", image: "/assets/building-materials.jpg" },
    { name: "Aluminium & Roofing", image: "/assets/aluminium.jpg" },
    { name: "Cement, Blocks & Interlock", image: "/assets/cement.jpg" },
    { name: "Gravel, Sharp Sand & Quarry", image: "/assets/sand.jpg" },
    { name: "Electrical Supplies", image: "/assets/electrical.jpg" },
    { name: "Plumbing Materials", image: "/assets/plumbing.jpg" },
    { name: "Tiles & Paints", image: "/assets/tiles.jpg" },
    { name: "Metal & Iron Works", image: "/assets/metal.jpg" },
    { name: "Carpenters & Artisans", image: "/assets/carpenters.jpg" },
  
    // 🏥 Health & Beauty
    { name: "Pharmacy & Patent Stores", image: "/assets/pharmacy.jpg" },
    { name: "Hospital & Medical Equipment", image: "/assets/medical-equipment.jpg" },
    { name: "Herbal Medicine", image: "/assets/herbal.jpg" },
    { name: "Maternity & Clinics", image: "/assets/maternity.jpg" },
    { name: "Fitness & Supplements", image: "/assets/fitness.jpg" },
  
    // 💻 Electronics & Gadgets
    { name: "Phones & Accessories / Laptops & Computers", image: "/assets/phones.jpg" },
    { name: "Solar & Inverters", image: "/assets/solar.jpg" },
    { name: "CCTV & Security Devices", image: "/assets/cctv.jpg" },
    { name: "Game Consoles & Accessories", image: "/assets/games.jpg" },
  
    // 🧾 Office & Services
    { name: "Printing Press", image: "/assets/printing.jpg" },
    { name: "Stationery & Office Supplies", image: "/assets/stationery.jpg" },
    { name: "Internet & Data Services", image: "/assets/internet.jpg" },
    { name: "Freelancers & Digital Services", image: "/assets/freelancers.jpg" },
  
    // 🚗 Auto & Transport
    { name: "Car Dealers / Tokunbo Cars", image: "/assets/cars.jpg" },
    { name: "Car Spare Parts", image: "/assets/spare-parts.jpg" },
    { name: "Auto Mechanics", image: "/assets/mechanics.jpg" },
    { name: "Tyres, Batteries & Accessories", image: "/assets/tyres.jpg" },
    { name: "Car Wash & Detailing", image: "/assets/car-wash.jpg" },
  
    // 🧺 Laundry & Cleaning
    { name: "Laundry Services", image: "/assets/laundry.jpg" },
    { name: "Dry Cleaning", image: "/assets/dry-cleaning.jpg" },
    { name: "House Cleaning", image: "/assets/house-cleaning.jpg" },
  
    // 🐄 Agriculture
    { name: "Animal Feed & Supplements", image: "/assets/animal-feed.jpg" },
    { name: "Fish Farming", image: "/assets/fish-farming.jpg" },
  
    // 🐕 Pets
    { name: "Pets (Dogs, Cats, Birds)", image: "/assets/pets.jpg" },
    { name: "Pet Food & Accessories", image: "/assets/pet-food.jpg" },
    { name: "Veterinary Clinics", image: "/assets/veterinary.jpg" },
    { name: "Pet Grooming", image: "/assets/pet-grooming.jpg" },
  
    // 🏡 Real Estate
    { name: "Real Estate Agents", image: "/assets/real-estate.jpg" },
    { name: "Rentals & Sales", image: "/assets/rentals.jpg" },
    { name: "Facility Management", image: "/assets/facility.jpg" },
    { name: "Movers & Packers", image: "/assets/movers.jpg" },
  
    // 🧠 Professional
    { name: "Legal Services", image: "/assets/legal.jpg" },
    { name: "Accounting & Tax", image: "/assets/accounting.jpg" },
    { name: "Private Tutors", image: "/assets/tutors.jpg" },
    { name: "Event Planners", image: "/assets/event-planners.jpg" },
    { name: "Photography & Videography", image: "/assets/photography.jpg" },
    { name: "Tech Repairs", image: "/assets/tech-repairs.jpg" },
  
    // Fallback
    { name: "Other", image: "/assets/other.jpg" }
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
