const USERS_KEY = 'auto_control_users_v1';
const CURRENT_USER_KEY = 'auto_control_current_user_v1';

const brandIntervals = {
  'Toyota': 10000,
  'BMW': 8000,
  'Mercedes-Benz': 10000,
  'Volkswagen': 10000,
  'Hyundai': 10000,
  'Kia': 10000,
  'Lada': 7500,
  'Renault': 10000,
  'Nissan': 10000,
  'Ford': 10000
};

const partIntervals = {
  oil: { title: 'Масло', interval: 10000 },
  oilFilter: { title: 'Масляный фильтр', interval: 10000 },
  fuelFilter: { title: 'Топливный фильтр', interval: 30000 },
  airFilter: { title: 'Воздушный фильтр', interval: 15000 },
  brakePads: { title: 'Тормозные колодки', interval: 35000 }
};

let authMode = 'login';
let currentUser = loadCurrentUser();
let state = loadState();

function getUsers() {
  const saved = localStorage.getItem(USERS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY);
}

function setCurrentUser(name) {
  currentUser = name;
  if (name) localStorage.setItem(CURRENT_USER_KEY, name);
  else localStorage.removeItem(CURRENT_USER_KEY);
}

function getStorageKey() {
  return currentUser ? `auto_control_data_${currentUser}` : 'auto_control_guest_data';
}

function loadState() {
  if (!currentUser) return { cars: [] };
  const saved = localStorage.getItem(getStorageKey());
  return saved ? JSON.parse(saved) : { cars: [] };
}

function saveState() {
  if (!currentUser) return;
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  renderAll();
}

function showAuthModal() {
  document.getElementById('authModal').classList.add('active');
  renderAuthMode();
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  renderAuthMode();
}

function renderAuthMode() {
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const switchText = document.getElementById('authSwitchText');
  const switchBtn = document.querySelector('.link-btn');

  if (authMode === 'login') {
    title.textContent = 'Вход';
    subtitle.textContent = 'Введите данные, чтобы продолжить работу с гаражом.';
    switchText.textContent = 'Нет аккаунта?';
    switchBtn.textContent = 'Зарегистрироваться';
  } else {
    title.textContent = 'Регистрация';
    subtitle.textContent = 'Создайте локальный профиль для хранения автомобилей.';
    switchText.textContent = 'Уже есть аккаунт?';
    switchBtn.textContent = 'Войти';
  }
}

function submitAuth() {
  const name = document.getElementById('authName').value.trim();
  const password = document.getElementById('authPassword').value.trim();

  if (!name || !password) {
    alert('Введите имя пользователя и пароль');
    return;
  }

  const users = getUsers();
  const found = users.find(user => user.name.toLowerCase() === name.toLowerCase());

  if (authMode === 'register') {
    if (found) {
      alert('Такой пользователь уже существует');
      return;
    }

    users.push({ name, password, createdAt: new Date().toISOString() });
    saveUsers(users);
    setCurrentUser(name);
    state = loadState();
    closeAuthModal();
    clearAuthForm();
    showSection('garage');
    renderAll();
    return;
  }

  if (!found || found.password !== password) {
    alert('Неверное имя пользователя или пароль');
    return;
  }

  setCurrentUser(found.name);
  state = loadState();
  closeAuthModal();
  clearAuthForm();
  showSection('garage');
  renderAll();
}

function clearAuthForm() {
  document.getElementById('authName').value = '';
  document.getElementById('authPassword').value = '';
}

function logout() {
  setCurrentUser(null);
  state = { cars: [] };
  showSection('home');
  renderAll();
}

function openGarage() {
  if (!currentUser) {
    showAuthModal();
    return;
  }
  showSection('garage');
}

function showSection(id) {
  if (id === 'garage' && !currentUser) {
    showAuthModal();
    return;
  }

  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  renderAll();
}

function openCarModal() {
  if (!currentUser) {
    showAuthModal();
    return;
  }

  document.getElementById('carModal').classList.add('active');
  updateBrandHint();
}

function closeCarModal() {
  document.getElementById('carModal').classList.remove('active');
}

function toggleDetails() {
  const detailsToggle = document.getElementById('detailsToggle');
  document.getElementById('detailsBlock').classList.toggle('active', detailsToggle.checked);
}

function updateBrandHint() {
  const brand = document.getElementById('carBrand').value;
  document.getElementById('brandHint').textContent =
    `Рекомендуемый интервал общего ТО для ${brand}: каждые ${brandIntervals[brand].toLocaleString('ru-RU')} км`;
}

function addCar() {
  const brand = document.getElementById('carBrand').value;
  const model = document.getElementById('carModel').value.trim();
  const mileage = Number(document.getElementById('carMileage').value);
  const lastServiceMileage = Number(document.getElementById('lastServiceMileage').value);
  const hasDetails = document.getElementById('detailsToggle').checked;

  if (!currentUser) {
    showAuthModal();
    return;
  }

  if (!brand || !model || !mileage || !lastServiceMileage) {
    alert('Заполните марку, модель, текущий пробег и последнее ТО');
    return;
  }

  if (lastServiceMileage > mileage) {
    alert('Пробег последнего ТО не может быть больше текущего пробега');
    return;
  }

  const details = hasDetails ? {
    oil: Number(document.getElementById('oilMileage').value) || lastServiceMileage,
    oilFilter: Number(document.getElementById('oilFilterMileage').value) || lastServiceMileage,
    fuelFilter: Number(document.getElementById('fuelFilterMileage').value) || lastServiceMileage,
    airFilter: Number(document.getElementById('airFilterMileage').value) || lastServiceMileage,
    brakePads: Number(document.getElementById('brakePadsMileage').value) || lastServiceMileage
  } : null;

  state.cars.push({
    id: Date.now().toString(),
    brand,
    model,
    mileage,
    lastServiceMileage,
    interval: brandIntervals[brand],
    details,
    createdAt: new Date().toISOString()
  });

  clearCarForm();
  closeCarModal();
  saveState();
}

function clearCarForm() {
  document.getElementById('carModel').value = '';
  document.getElementById('carMileage').value = '';
  document.getElementById('lastServiceMileage').value = '';
  document.getElementById('detailsToggle').checked = false;
  document.getElementById('detailsBlock').classList.remove('active');

  ['oilMileage', 'oilFilterMileage', 'fuelFilterMileage', 'airFilterMileage', 'brakePadsMileage'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function deleteCar(id) {
  if (!confirm('Удалить автомобиль из гаража?')) return;
  state.cars = state.cars.filter(car => car.id !== id);
  saveState();
}

function getStatus(currentMileage, lastMileage, interval) {
  const passed = currentMileage - lastMileage;

  if (passed >= interval) return { text: 'Необходимо ТО', cls: 'status-bad', passed };
  if (passed >= interval * 0.8) return { text: 'Скоро ТО', cls: 'status-soon', passed };

  return { text: 'Норма', cls: 'status-ok', passed };
}

function renderGarage() {
  const container = document.getElementById('garageGrid');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = '<div class="empty">Войдите или зарегистрируйтесь, чтобы открыть личный гараж.</div>';
    return;
  }

  const addCard = `
    <div class="card add-card" onclick="openCarModal()">
      <div>
        <div class="plus-circle">+</div>
        <h3>Добавить автомобиль</h3>
        <p class="muted">Марка, модель, пробег, последнее ТО и состояние расходников</p>
      </div>
    </div>
  `;

  const carCards = state.cars.map(car => {
    const general = getStatus(car.mileage, car.lastServiceMileage, car.interval);

    const details = car.details ? Object.entries(partIntervals).map(([key, item]) => {
      const status = getStatus(car.mileage, car.details[key], item.interval);
      return `
        <div class="status-row">
          <span>${item.title}<br><small class="muted">после замены: ${status.passed.toLocaleString('ru-RU')} км</small></span>
          <span class="status-pill ${status.cls}">${status.text}</span>
        </div>
      `;
    }).join('') : '<p class="muted">Подробные расходники не указаны.</p>';

    return `
      <div class="card">
        <div class="car-title">
          <div>
            <h3>${car.brand} ${car.model}</h3>
            <p class="muted">Текущий пробег: ${car.mileage.toLocaleString('ru-RU')} км</p>
          </div>
          <span class="status-pill ${general.cls}">${general.text}</span>
        </div>

        <div class="service-list">
          <div class="status-row">
            <span>
              Общее ТО<br>
              <small class="muted">интервал: ${car.interval.toLocaleString('ru-RU')} км · прошло: ${general.passed.toLocaleString('ru-RU')} км</small>
            </span>
            <span class="status-pill ${general.cls}">${general.text}</span>
          </div>
          ${details}
        </div>

        <div class="actions">
          <button class="btn danger" onclick="deleteCar('${car.id}')">Удалить</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = addCard + carCards;
}

function renderStats() {
  document.getElementById('statCars').textContent = currentUser ? state.cars.length : 0;
  document.getElementById('statServices').textContent = currentUser ? state.cars.filter(car => car.details).length : 0;

  const mileage = currentUser ? state.cars.reduce((sum, car) => sum + Number(car.mileage || 0), 0) : 0;
  document.getElementById('statMileage').textContent = mileage.toLocaleString('ru-RU');
}

function renderAuthUI() {
  const authBtn = document.getElementById('authBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const garageBtn = document.getElementById('garageBtn');
  const userBadge = document.getElementById('userBadge');

  if (currentUser) {
    authBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    garageBtn.style.display = 'inline-block';
    userBadge.style.display = 'inline-flex';
    userBadge.textContent = `Пользователь: ${currentUser}`;
  } else {
    authBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    garageBtn.style.display = 'none';
    userBadge.style.display = 'none';
    userBadge.textContent = '';
  }
}

function renderAll() {
  renderAuthUI();
  renderStats();
  renderGarage();
}

renderAll();