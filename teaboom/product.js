'use strict';

// Prices are stored in kopecks, avoiding floating-point monetary calculations.
const packages = {
  100: { sku: '01306', price: 32640, oldPrice: 34920 },
  500: { sku: '01307', price: 143200, oldPrice: 164600 },
  1000: { sku: '01308', price: 206400, oldPrice: 259200 },
  5000: { sku: '01309', price: 632000, oldPrice: 871000 },
};

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const form = document.querySelector('#purchase-form');
const sku = document.querySelector('#sku');
const currentPrice = document.querySelector('#current-price');
const oldPrice = document.querySelector('#old-price');
const cartStatus = document.querySelector('#cart-status');

function renderPackage(weight) {
  const selected = packages[weight];
  if (!selected) return;
  sku.textContent = selected.sku;
  currentPrice.textContent = currency.format(selected.price / 100);
  oldPrice.textContent = currency.format(selected.oldPrice / 100);
  cartStatus.textContent = '';
}

form.addEventListener('change', (event) => {
  if (event.target.matches('input[name="package"]')) {
    renderPackage(event.target.value);
  }
});

// Local feedback only: no requests, order, payment or real cart integration.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const selected = form.querySelector('input[name="package"]:checked');
  cartStatus.textContent = `Выбрано ${selected.value} г, арт. ${packages[selected.value].sku}. Это демо — заказ не создан.`;
});

renderPackage(form.querySelector('input[name="package"]:checked').value);
