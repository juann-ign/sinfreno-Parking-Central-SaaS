import { randomInt } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { disposableE2EEnabled } from '../playwright.config.js';

const operatorEmail = process.env.SINFRENO_E2E_OPERATOR_EMAIL || 'operador@release.example.com';
const northEmail = process.env.SINFRENO_E2E_NORTH_EMAIL || 'admin.norte@release.example.com';
// This is the explicitly fictitious seed password, never a production credential.
const demoPassword = process.env.SINFRENO_E2E_PASSWORD || 'Sinfreno-demo-local-2026';

function carPlate() {
  const letter = () => String.fromCharCode(65 + randomInt(26));
  return `${letter()}${letter()}${String(randomInt(1000)).padStart(3, '0')}${letter()}${letter()}`;
}

test.skip(
  !disposableE2EEnabled,
  'Optional demo QA: set SINFRENO_E2E_URL and SINFRENO_E2E_ALLOW_DISPOSABLE=1.',
);

async function restrictToLoopback(context) {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname)
      ? route.continue()
      : route.abort('blockedbyclient');
  });
}

test.beforeEach(async ({ context }) => {
  await restrictToLoopback(context);
});

async function login(page, email) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(demoPassword);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entradas y salidas', exact: true })).toBeVisible();
  await expect(page.locator('.sf-branch')).toContainText(email);
}

function activeTable(page) {
  return page.getByRole('table', { name: 'Vehículos activos de esta sucursal', exact: true });
}

function ownReceipts(page) {
  return page.getByRole('table', { name: 'Comprobantes recuperables de tus operaciones', exact: true });
}

function plateRow(table, plate) {
  return table.getByRole('row').filter({ hasText: plate });
}

async function waitForActiveList(page) {
  await expect(activeTable(page)).toBeVisible();
  await expect(activeTable(page).getByRole('status')).toHaveCount(0);
  await expect(page.locator('.sf-active-list').getByRole('alert')).toHaveCount(0);
}

async function enterByKeyboard(page, plate) {
  const input = page.getByLabel('Patente', { exact: true });
  await expect(input).toBeEnabled();
  await page.getByRole('heading', { name: 'Entradas y salidas', exact: true }).click();
  await page.keyboard.press('n');
  await expect(input).toBeFocused();
  await page.keyboard.type(plate);
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  await expect(plateRow(activeTable(page), plate)).toHaveCount(1);
  await expect(plateRow(ownReceipts(page), plate)).toContainText('Ingreso');
}

async function openReceipt(page, plate, exit) {
  const row = plateRow(ownReceipts(page), plate);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(exit ? 'Salida' : 'Ingreso');
  await row.getByRole('button', { name: 'Ver comprobante', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: exit ? 'Cobro registrado' : 'Ingreso registrado', exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: plate, exact: true })).toBeVisible();
  return dialog;
}

async function closeReceipt(page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function observePrintRequests(page) {
  await page.addInitScript(() => {
    window.ticketPrintRequests = [];
    // The native chooser can finish after either printing or cancelling.
    window.print = () => {
      const ticket = document.querySelector('dialog[open] #sinfreno-print-receipt');
      window.ticketPrintRequests.push(ticket?.innerText ?? null);
      window.dispatchEvent(new Event('afterprint'));
    };
  });
}

async function registerExit(page, plate) {
  await plateRow(activeTable(page), plate)
    .getByRole('button', { name: 'Cotizar salida', exact: true }).click();
  const quote = page.getByRole('region', { name: `Cotización para ${plate}`, exact: true });
  await expect(quote).toBeVisible();
  await quote.getByRole('radio', { name: 'Efectivo', exact: true }).check();
  const confirm = quote.getByRole('button', { name: /^Registrar cobro de / });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(quote).toHaveCount(0);
  await expect(plateRow(activeTable(page), plate)).toHaveCount(0);
  await expect(plateRow(ownReceipts(page), plate)).toContainText('Salida');
}

async function finishOwnStay(page, plate) {
  // Preserve the receipt/history: cleanup only registers an ordinary UI exit.
  await page.goto('/dashboard');
  await waitForActiveList(page);
  await page.getByRole('textbox', { name: /^Buscar patente activa/ }).fill(plate);
  const row = plateRow(activeTable(page), plate);
  if (await row.count()) await registerExit(page, plate);
}

test('plate validity updates per keystroke and category, warning and Enter guard stay in sync', async ({ page }) => {
  let entryRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/parking/ingreso')) entryRequests += 1;
  });
  await login(page, operatorEmail);
  const input = page.getByLabel('Patente', { exact: true });
  const submit = page.getByRole('button', { name: 'Registrar ingreso', exact: true });
  const warning = page.locator('#entry-plate-warning');
  await expect(input).toBeEnabled();
  await expect(submit).toBeDisabled();
  await expect(warning).toHaveCount(0);
  let expected = '';
  for (const character of 'ab12') {
    await input.press(character);
    expected += character.toUpperCase();
    await expect(input).toHaveValue(expected);
    await expect(submit).toBeDisabled();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  }
  await expect(warning).toContainText('ABC123 o AB123CD');
  await input.press('Enter');
  await expect(input).toHaveValue('AB12');
  await input.fill('abc123');
  await expect(input).toHaveValue('ABC123');
  await expect(submit).toBeEnabled();
  await expect(warning).toHaveCount(0);
  await page.getByRole('radio', { name: 'Moto', exact: true }).check();
  await expect(submit).toBeDisabled();
  await expect(warning).toContainText('123ABC o A123BCD');
  await input.fill('123abc');
  await expect(submit).toBeEnabled();
  await input.fill('a123bcd');
  await expect(submit).toBeEnabled();
  await page.getByRole('radio', { name: 'Camioneta', exact: true }).check();
  await expect(submit).toBeDisabled();
  await input.fill('ab 123 cd');
  await expect(input).toHaveValue('AB123CD');
  await expect(submit).toBeEnabled();
  await input.fill('ab!123cd');
  await expect(input).toHaveValue('AB!123CD');
  await expect(submit).toBeDisabled();
  await expect(warning).toBeVisible();
  await input.press('Enter');
  await input.fill('');
  await expect(warning).toHaveCount(0);
  await expect(submit).toBeDisabled();
  expect(entryRequests).toBe(0);
});

test('keyboard entry creates one stay, confirms a quote and recovers its receipt after F5', async ({ page }) => {
  const plate = carPlate();
  let entryRequests = 0;
  let exitRequests = 0;
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/parking/ingreso')) entryRequests += 1;
    if (/\/parking\/\d+\/salida$/.test(pathname)) exitRequests += 1;
  });
  await login(page, operatorEmail);
  try {
    await enterByKeyboard(page, plate);
    const entry = await openReceipt(page, plate, false);
    const code = await entry.locator('.sf-ticket-code figcaption').innerText();
    expect(code).toMatch(/^SF-[1-9][0-9]*$/);
    await expect(entry.locator('.sf-ticket-code svg g rect').first()).toBeVisible();
    await closeReceipt(page);
    const search = page.getByRole('textbox', { name: /^Buscar patente activa/ });
    await search.fill(plate.slice(0, 4));
    await search.press('Enter');
    await expect(page.locator('.sf-quote')).toHaveCount(0);
    await search.fill(code);
    await search.press('Enter');
    const quote = page.getByRole('region', { name: `Cotización para ${plate}`, exact: true });
    await expect(quote.getByRole('button', { name: /^Registrar cobro de / })).toBeEnabled();
    expect(exitRequests).toBe(0);
    await quote.getByRole('button', { name: /^Registrar cobro de / }).click();
    await expect(plateRow(ownReceipts(page), plate)).toContainText('Salida');
    await search.fill(code);
    await search.press('Enter');
    await expect(activeTable(page)).toContainText('No hay vehículos');
    await expect(page.locator('.sf-quote')).toHaveCount(0);
    const receipt = await openReceipt(page, plate, true);
    const receiptText = await receipt.locator('#sinfreno-print-receipt').innerText();
    expect(entryRequests).toBe(1);
    expect(exitRequests).toBe(1);

    // A full browser reload exercises the same session restoration as F5.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Entradas y salidas', exact: true })).toBeVisible();
    const recovered = await openReceipt(page, plate, true);
    await expect(recovered.locator('#sinfreno-print-receipt')).toHaveText(receiptText, { useInnerText: true });
    expect(entryRequests).toBe(1);
    expect(exitRequests).toBe(1);
  } finally {
    await finishOwnStay(page, plate);
  }
});

test('independent operator and branch-admin contexts enforce role and branch boundaries', async ({ page, browser, baseURL }) => {
  const northContext = await browser.newContext({ baseURL });
  await restrictToLoopback(northContext);
  const northPage = await northContext.newPage();
  const plate = carPlate();
  let operatorReady = false;
  try {
    await login(page, operatorEmail);
    operatorReady = true;
    await login(northPage, northEmail);
    const centerBranch = await page.locator('.sf-branch strong').innerText();
    const northBranch = await northPage.locator('.sf-branch strong').innerText();
    expect(centerBranch).not.toBe(northBranch);
    await expect(page.locator('.sf-branch')).toContainText('Operador');
    await expect(northPage.locator('.sf-branch')).toContainText('Administrador');
    await expect(page.getByRole('link', { name: 'Equipo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Historial', exact: true })).toHaveCount(0);
    await expect(northPage.getByRole('link', { name: 'Equipo', exact: true })).toBeVisible();
    await enterByKeyboard(page, plate);

    await northPage.reload();
    await waitForActiveList(northPage);
    await northPage.getByRole('textbox', { name: /^Buscar patente activa/ }).fill(plate);
    await expect(plateRow(activeTable(northPage), plate)).toHaveCount(0);
    await expect(ownReceipts(northPage)).toBeVisible();
    await expect(plateRow(ownReceipts(northPage), plate)).toHaveCount(0);

    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Acceso no disponible', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Volver al inicio', exact: true }).click();
    await expect(page.locator('.sf-branch')).toContainText(operatorEmail);
    await northPage.reload();
    await expect(northPage.locator('.sf-branch')).toContainText(northEmail);
    await expect(northPage.locator('.sf-branch strong')).toHaveText(northBranch);
    await expect(page.locator('.sf-branch strong')).toHaveText(centerBranch);
  } finally {
    try {
      if (operatorReady) await finishOwnStay(page, plate);
    } finally {
      await northContext.close();
    }
  }
});

test('desk printing follows confirmation once, returns focus and prints another copy without another charge', async ({ page }) => {
  const plate = carPlate();
  let entries = 0;
  let exits = 0;
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/parking/ingreso')) entries += 1;
    if (/\/parking\/\d+\/salida$/.test(path)) exits += 1;
  });
  await observePrintRequests(page);
  await login(page, operatorEmail);
  const setting = page.getByRole('checkbox', { name: 'Imprimir al registrar en este puesto', exact: true });
  await expect(setting).not.toBeChecked();
  await setting.check();
  await page.reload();
  await expect(setting).toBeChecked();
  const prints = () => page.evaluate(() => window.ticketPrintRequests);
  const lastTicket = page.getByRole('button', { name: `Imprimir último ticket · ${plate}`, exact: true });
  try {
    await expect(page.getByRole('button', { name: 'Ingresar e imprimir', exact: true })).toBeVisible();
    expect(await prints()).toHaveLength(0);
    await enterByKeyboard(page, plate);
    await expect.poll(prints).toHaveLength(1);
    expect((await prints())[0]).toContain(plate);
    await expect(page.getByLabel('Patente', { exact: true })).toBeFocused();
    await lastTicket.click();
    await expect.poll(prints).toHaveLength(2);
    expect((await prints())[1]).toEqual((await prints())[0]);
    await registerExit(page, plate);
    await expect.poll(prints).toHaveLength(3);
    expect((await prints())[2]).toContain(plate);
    expect((await prints())[2]).not.toEqual((await prints())[0]);
    await expect(page.getByRole('textbox', { name: /^Buscar patente activa/ })).toBeFocused();
    await lastTicket.click();
    await expect.poll(prints).toHaveLength(4);
    expect((await prints())[3]).toEqual((await prints())[2]);
    await page.reload();
    await openReceipt(page, plate, true);
    expect(await prints()).toHaveLength(0);
    await closeReceipt(page);
    expect(entries).toBe(1);
    expect(exits).toBe(1);
  } finally {
    await finishOwnStay(page, plate);
  }
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await login(page, northEmail);
  await expect(setting).not.toBeChecked();
  await expect(lastTicket).toHaveCount(0);
  expect(await prints()).toHaveLength(0);
});

test('print media keeps an authorized receipt visible and hides the workspace', async ({ page }) => {
  await login(page, operatorEmail);
  const view = ownReceipts(page).getByRole('button', { name: 'Ver comprobante', exact: true }).first();
  await expect(view).toBeVisible();
  await view.click();
  const receipt = page.locator('#sinfreno-print-receipt');
  const plate = await receipt.getByRole('heading').innerText();
  await expect(receipt).toBeVisible();
  try {
    await page.emulateMedia({ media: 'print' });
    await expect(receipt).toBeVisible();
    await expect(receipt.getByRole('heading', { name: plate, exact: true })).toBeVisible();
    await expect(receipt).toHaveCSS('position', 'static');
    await expect(page.getByRole('heading', { name: 'Entradas y salidas', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Imprimir comprobante', exact: true })).toBeHidden();
    await expect(page.getByRole('dialog')).toHaveCSS('overflow', 'visible');
    await expect(page.getByRole('dialog')).toHaveCSS('max-height', 'none');
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }
});

test('an uncertain entry survives reload and recovers its real result without a second POST', async ({ page }) => {
  const plate = carPlate();
  let entryRequests = 0;
  let backendStatus;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/parking/ingreso') {
      entryRequests += 1;
    }
  });
  await observePrintRequests(page);
  await login(page, operatorEmail);
  await page.getByRole('checkbox', { name: 'Imprimir al registrar en este puesto', exact: true }).check();
  await page.route('**/api/v1/parking/ingreso', async (route) => {
    try {
      // Process the real command exactly once, then lose only its response.
      const requestURL = new URL(route.request().url());
      expect(['127.0.0.1', 'localhost']).toContain(requestURL.hostname);
      expect(route.request().method()).toBe('POST');
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
      backendStatus = response.status();
      expect(backendStatus).toBe(200);
    } finally {
      await route.abort('failed');
    }
  }, { times: 1 });
  try {
    const input = page.getByLabel('Patente', { exact: true });
    await expect(input).toBeEnabled();
    await input.fill(plate);
    await input.press('Enter');
    const pending = page.getByRole('region', { name: 'Operaciones con resultado pendiente', exact: true });
    const attempt = pending.locator('.sf-recovery-row').filter({ hasText: plate });
    await expect(pending.getByRole('heading', { name: 'Resultado por confirmar', exact: true })).toBeVisible();
    await expect(attempt).toHaveCount(1);
    const reference = await attempt.locator('small').innerText();
    expect(backendStatus).toBe(200);
    expect(entryRequests).toBe(1);
    expect(await page.evaluate(() => window.ticketPrintRequests)).toHaveLength(0);

    await page.reload();
    await expect(pending.getByRole('heading', { name: 'Resultado por confirmar', exact: true })).toBeVisible();
    await expect(attempt.locator('small')).toHaveText(reference);
    await expect(page.getByLabel('Patente', { exact: true })).toBeDisabled();
    expect(entryRequests).toBe(1);

    const recoveryResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET' &&
      /^\/api\/v1\/parking\/operaciones\/INGRESO\/[^/]+$/.test(new URL(response.url()).pathname)
    ));
    await attempt.getByRole('button', { name: 'Recuperar resultado', exact: true }).click();
    expect((await recoveryResponse).status()).toBe(200);
    await expect(pending).toHaveCount(0);
    await expect(plateRow(activeTable(page), plate)).toHaveCount(1);
    await openReceipt(page, plate, false);
    expect(entryRequests).toBe(1);
    expect(await page.evaluate(() => window.ticketPrintRequests)).toHaveLength(0);
  } finally {
    await finishOwnStay(page, plate);
  }
});
