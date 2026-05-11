const firebaseConfig = {
  apiKey: "AIzaSyDlagRmKWlxKTUHeDdri5TECRVkdPDdn-E",
  authDomain: "auto-control-878a5.firebaseapp.com",
  projectId: "auto-control-878a5",
  storageBucket: "auto-control-878a5.firebasestorage.app",
  messagingSenderId: "247827010967",
  appId: "1:247827010967:web:4a4333a721dd88facb20d2"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

const fallbackMakes = [
  'Toyota', 'BMW', 'Mercedes-Benz', 'Volkswagen', 'Hyundai',
  'Kia', 'Lada', 'Renault', 'Nissan', 'Ford', 'Honda', 'Mazda',
  'Audi', 'Lexus', 'Skoda', 'Chevrolet'
];

const brandIntervals = {
  'TOYOTA': 10000,
  'BMW': 8000,
  'MERCEDES-BENZ': 10000,
  'MERCEDES BENZ': 10000,
  'VOLKSWAGEN': 10000,
  'HYUNDAI': 10000,
  'KIA': 10000,
  'LADA': 7500,
  'RENAULT': 10000,
  'NISSAN': 10000,
  'FORD': 10000,
  'HONDA': 10000,
  'MAZDA': 10000,
  'AUDI': 10000,
  'LEXUS': 10000,
  'SKODA': 10000,
  'CHEVROLET': 10000
};

const defaultRegulation = {
  generalTO: 10000,
  oil: 10000,
  oilFilter: 10000,
  fuelFilter: 30000,
  airFilter: 15000,
  brakePads: 35000
};

let authMode = 'login';
let currentUser = null;
let state = { cars: [] };
let unsubscribeCars = null;
let availableMakes = [];

function normalizeText(value) {
  return String(value || '').trim();
}

function makeDocId(brand, model) {
  return `${normalizeText(brand)}_${normalizeText(model)}`
    .replace(/[^\wа-яА-ЯёЁ]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getDefaultRegulationForBrand(brand) {
  const key = normalizeText(brand).toUpperCase();
  const generalTO = brandIntervals[key] || defaultRegulation.generalTO;

  return {
    ...defaultRegulation,
    generalTO,
    oil: generalTO,
    oilFilter: generalTO
  };
}

function getCustomRegulations(baseRegulations) {
  const customToggle = document.getElementById('customIntervalsToggle');

  if (!customToggle || !customToggle.checked) {
    return baseRegulations;
  }

  return {
    generalTO: Number(document.getElementById('customGeneralTO').value) || baseRegulations.generalTO,
    oil: Number(document.getElementById('customOilInterval').value) || baseRegulations.oil,
    oilFilter: Number(document.getElementById('customOilFilterInterval').value) || baseRegulations.oilFilter,
    fuelFilter: Number(document.getElementById('customFuelFilterInterval').value) || baseRegulations.fuelFilter,
    airFilter: Number(document.getElementById('customAirFilterInterval').value) || baseRegulations.airFilter,
    brakePads: Number(document.getElementById('customBrakePadsInterval').value) || baseRegulations.brakePads
  };
}


async function getRegulationForCar(brand, model) {
  const fallback = getDefaultRegulationForBrand(brand);

  try {
    const docId = makeDocId(brand, model);
    const doc = await db.collection('serviceRegulations').doc(docId).get();

    if (!doc.exists) return fallback;

    const data = doc.data();

    return {
      generalTO: Number(data.generalTO) || fallback.generalTO,
      oil: Number(data.oil) || fallback.oil,
      oilFilter: Number(data.oilFilter) || fallback.oilFilter,
      fuelFilter: Number(data.fuelFilter) || fallback.fuelFilter,
      airFilter: Number(data.airFilter) || fallback.airFilter,
      brakePads: Number(data.brakePads) || fallback.brakePads
    };
  } catch (error) {
    console.warn('Не удалось загрузить точный регламент, используется базовый:', error);
    return fallback;
  }
}

async function loadVehicleMakes() {
  const select = document.getElementById('carBrand');
  if (!select) return;

  select.disabled = true;
  select.innerHTML = '<option value="">Загрузка марок из API...</option>';

  try {
    const response = await fetch(`${NHTSA_BASE_URL}/GetMakesForVehicleType/car?format=json`);

    if (!response.ok) {
      throw new Error('API недоступен');
    }

    const data = await response.json();

    availableMakes = [...new Set(
      data.Results
        .map(item => normalizeText(item.MakeName || item.Make_Name || item.make_name))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ru'));

    if (!availableMakes.length) {
      throw new Error('API вернул пустой список');
    }

    renderMakeOptions(availableMakes);
    console.log(`Загружено марок из API: ${availableMakes.length}`);
  } catch (error) {
    console.warn('Не удалось загрузить марки из API, используется запасной список:', error);
    renderMakeOptions(fallbackMakes);
  }
}

function renderMakeOptions(makes) {
  const select = document.getElementById('carBrand');
  if (!select) return;

  select.disabled = false;
  select.innerHTML = '<option value="">Выберите марку</option>' + makes.map(make => `
    <option value="${make}">${make}</option>
  `).join('');
}

async function handleBrandChange() {
  const brand = document.getElementById('carBrand').value;
  await loadModelsForBrand(brand);
  updateBrandHint();
}

async function loadModelsForBrand(brand) {
  const modelSelect = document.getElementById('carModel');
  if (!modelSelect) return;

  if (!brand) {
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option value="">Сначала выберите марку</option>';
    return;
  }

  modelSelect.disabled = true;
  modelSelect.innerHTML = '<option value="">Загрузка моделей...</option>';

  try {
    const response = await fetch(`${NHTSA_BASE_URL}/GetModelsForMake/${encodeURIComponent(brand)}?format=json`);
    const data = await response.json();

    const models = [...new Set(
      data.Results
        .map(item => normalizeText(item.Model_Name || item.ModelName || item.model_name))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ru'));

    if (!models.length) {
      modelSelect.innerHTML = '<option value="">Модели не найдены</option>';
      return;
    }

    modelSelect.disabled = false;
    modelSelect.innerHTML = '<option value="">Выберите модель</option>' + models.map(model => `
      <option value="${model}">${model}</option>
    `).join('');
  } catch (error) {
    console.warn('Не удалось загрузить модели:', error);
    modelSelect.disabled = false;
    modelSelect.innerHTML = '<option value="">Не удалось загрузить модели</option>';
  }
}

function getCarsCollection() {
  return db.collection('users').doc(currentUser.uid).collection('cars');
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
    subtitle.textContent = 'Введите email и пароль, чтобы открыть гараж.';
    switchText.textContent = 'Нет аккаунта?';
    switchBtn.textContent = 'Зарегистрироваться';
  } else {
    title.textContent = 'Регистрация';
    subtitle.textContent = 'Создайте профиль для облачного хранения автомобилей.';
    switchText.textContent = 'Уже есть аккаунт?';
    switchBtn.textContent = 'Войти';
  }
}

async function submitAuth() {
  const email = document.getElementById('authName').value.trim();
  const password = document.getElementById('authPassword').value.trim();

  if (!email || !password) {
    alert('Введите email и пароль');
    return;
  }

  try {
    if (authMode === 'register') {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);

      await db.collection('users').doc(userCredential.user.uid).set({
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }

    closeAuthModal();
    clearAuthForm();
    showSection('garage');
  } catch (error) {
    alert(getAuthErrorMessage(error));
  }
}

function getAuthErrorMessage(error) {
  const code = error.code || '';

  if (code.includes('email-already-in-use')) return 'Такой email уже зарегистрирован';
  if (code.includes('invalid-email')) return 'Некорректный email';
  if (code.includes('weak-password')) return 'Пароль должен быть минимум 6 символов';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Неверный email или пароль';
  }

  return 'Ошибка авторизации: ' + error.message;
}

function clearAuthForm() {
  document.getElementById('authName').value = '';
  document.getElementById('authPassword').value = '';
}

async function logout() {
  await auth.signOut();
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

  loadVehicleMakes();
  updateBrandHint();
}

function closeCarModal() {
  document.getElementById('carModal').classList.remove('active');
}

function toggleDetails() {
  const detailsToggle = document.getElementById('detailsToggle');
  document.getElementById('detailsBlock').classList.toggle('active', detailsToggle.checked);
}

function toggleCustomIntervals() {
  const customToggle = document.getElementById('customIntervalsToggle');
  document.getElementById('customIntervalsBlock').classList.toggle('active', customToggle.checked);
}

function updateBrandHint() {
  const hint = document.getElementById('brandHint');

  if (!hint) return;

  hint.textContent = '';
}

async function addCar() {
  const brand = document.getElementById('carBrand').value;
  const model = document.getElementById('carModel').value;
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

  const baseRegulations = await getRegulationForCar(brand, model);
  const regulations = getCustomRegulations(baseRegulations);

  const details = hasDetails ? {
    oil: Number(document.getElementById('oilMileage').value) || lastServiceMileage,
    oilFilter: Number(document.getElementById('oilFilterMileage').value) || lastServiceMileage,
    fuelFilter: Number(document.getElementById('fuelFilterMileage').value) || lastServiceMileage,
    airFilter: Number(document.getElementById('airFilterMileage').value) || lastServiceMileage,
    brakePads: Number(document.getElementById('brakePadsMileage').value) || lastServiceMileage
  } : null;

  const carData = {
    brand,
    model,
    mileage,
    lastServiceMileage,
    interval: regulations.generalTO,
    regulations,
    customIntervals: document.getElementById('customIntervalsToggle').checked,
    details,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await getCarsCollection().add(carData);
    clearCarForm();
    closeCarModal();
  } catch (error) {
    alert('Не удалось добавить автомобиль: ' + error.message);
  }
}

function clearCarForm() {
  document.getElementById('carBrand').value = '';
  const modelSelect = document.getElementById('carModel');
  modelSelect.disabled = true;
  modelSelect.innerHTML = '<option value="">Сначала выберите марку</option>';

  document.getElementById('brandHint').textContent = '';
  document.getElementById('carMileage').value = '';
  document.getElementById('lastServiceMileage').value = '';
  document.getElementById('customIntervalsToggle').checked = false;
  document.getElementById('customIntervalsBlock').classList.remove('active');
  document.getElementById('detailsToggle').checked = false;
  document.getElementById('detailsBlock').classList.remove('active');

  ['customGeneralTO', 'customOilInterval', 'customOilFilterInterval', 'customFuelFilterInterval', 'customAirFilterInterval', 'customBrakePadsInterval', 'oilMileage', 'oilFilterMileage', 'fuelFilterMileage', 'airFilterMileage', 'brakePadsMileage'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

async function deleteCar(id) {
  if (!confirm('Удалить автомобиль из гаража?')) return;

  try {
    await getCarsCollection().doc(id).delete();
  } catch (error) {
    alert('Не удалось удалить автомобиль: ' + error.message);
  }
}

function getStatus(currentMileage, lastMileage, interval) {
  const passed = currentMileage - lastMileage;

  if (passed >= interval) {
    return { text: 'Необходимо ТО', cls: 'status-bad', passed };
  }

  if (passed >= interval * 0.8) {
    return { text: 'Скоро ТО', cls: 'status-soon', passed };
  }

  return { text: 'Норма', cls: 'status-ok', passed };
}

function getPartDefinitionsForCar(car) {
  const regulations = car.regulations || getDefaultRegulationForBrand(car.brand);

  return {
    oil: { title: 'Масло', interval: regulations.oil || defaultRegulation.oil },
    oilFilter: { title: 'Масляный фильтр', interval: regulations.oilFilter || defaultRegulation.oilFilter },
    fuelFilter: { title: 'Топливный фильтр', interval: regulations.fuelFilter || defaultRegulation.fuelFilter },
    airFilter: { title: 'Воздушный фильтр', interval: regulations.airFilter || defaultRegulation.airFilter },
    brakePads: { title: 'Тормозные колодки', interval: regulations.brakePads || defaultRegulation.brakePads }
  };
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
        
      </div>
    </div>
  `;

  const carCards = state.cars.map(car => {
    const generalInterval = car.interval || car.regulations?.generalTO || defaultRegulation.generalTO;
    const general = getStatus(car.mileage, car.lastServiceMileage, generalInterval);
    const partDefinitions = getPartDefinitionsForCar(car);

    const details = car.details ? Object.entries(partDefinitions).map(([key, item]) => {
      const status = getStatus(car.mileage, car.details[key], item.interval);

      return `
        <div class="status-row">
          <span>${item.title}<br><small class="muted">интервал: ${item.interval.toLocaleString('ru-RU')} км · после замены: ${status.passed.toLocaleString('ru-RU')} км</small></span>
          <span class="status-pill ${status.cls}">${status.text}</span>
        </div>
      `;
    }).join('') : '<p class="muted">Подробные расходники не указаны.</p>';

    return `
      <div class="card">
        <div class="car-title">
          <div>
            <h3>${car.brand} ${car.model}</h3>
            <p class="muted">Текущий пробег: ${Number(car.mileage).toLocaleString('ru-RU')} км</p>
          </div>
          <span class="status-pill ${general.cls}">${general.text}</span>
        </div>

        ${car.customIntervals ? '<div class="interval-note">Для этой машины используются индивидуальные интервалы ТО</div>' : '<div class="interval-note">Используются усреднённые интервалы ТО</div>'}
        <div class="service-list">
          <div class="status-row">
            <span>
              Общее ТО<br>
              <small class="muted">
                интервал: ${generalInterval.toLocaleString('ru-RU')} км · прошло: ${general.passed.toLocaleString('ru-RU')} км
              </small>
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

  const detailedCount = currentUser ? state.cars.filter(car => car.details).length : 0;
  document.getElementById('statServices').textContent = detailedCount;

  const mileage = currentUser
    ? state.cars.reduce((sum, car) => sum + Number(car.mileage || 0), 0)
    : 0;

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
    userBadge.textContent = `Пользователь: ${currentUser.email}`;
  } else {
    authBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    garageBtn.style.display = 'none';
    userBadge.style.display = 'none';
    userBadge.textContent = '';
  }
}

function listenUserCars() {
  if (unsubscribeCars) {
    unsubscribeCars();
    unsubscribeCars = null;
  }

  if (!currentUser) {
    state = { cars: [] };
    renderAll();
    return;
  }

  unsubscribeCars = getCarsCollection()
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      state.cars = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      renderAll();
    }, error => {
      alert('Ошибка загрузки гаража: ' + error.message);
    });
}

function renderAll() {
  renderAuthUI();
  renderStats();
  renderGarage();
}

auth.onAuthStateChanged(user => {
  currentUser = user;

  if (!user) {
    state = { cars: [] };
    if (document.getElementById('garage').classList.contains('active')) {
      showSection('home');
    }
  }

  listenUserCars();
  renderAll();
});

document.addEventListener('DOMContentLoaded', () => {
  loadVehicleMakes();
});
