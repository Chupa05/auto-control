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
let currentUser = null;
let state = { cars: [] };
let unsubscribeCars = null;

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

async function addCar() {
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

  const carData = {
    brand,
    model,
    mileage,
    lastServiceMileage,
    interval: brandIntervals[brand],
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
  document.getElementById('carModel').value = '';
  document.getElementById('carMileage').value = '';
  document.getElementById('lastServiceMileage').value = '';
  document.getElementById('detailsToggle').checked = false;
  document.getElementById('detailsBlock').classList.remove('active');

  ['oilMileage', 'oilFilterMileage', 'fuelFilterMileage', 'airFilterMileage', 'brakePadsMileage'].forEach(id => {
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
              <small class="muted">
                интервал: ${car.interval.toLocaleString('ru-RU')} км · прошло: ${general.passed.toLocaleString('ru-RU')} км
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
