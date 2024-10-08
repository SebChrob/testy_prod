import { test, expect } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

test("Logowanie w trakcie zakupu", async ({ page, browserName }) => {
  test.setTimeout(120000); // Ustawienie globalnego timeoutu na 120 sekund dla tego testu

  console.log(`Uruchamianie testu na przeglądarce: ${browserName}`);
  await page.context().clearCookies();
  await page.context().clearPermissions();

  // Przejdź do strony biżuterii
  console.log("Otwieranie strony: /bizuteria");
  await page.goto("https://yes.pl/bizuteria", {
    waitUntil: "networkidle",
  });

  // Sprawdź, czy okno z cookies jest widoczne i zaakceptuj je
  console.log("Sprawdzanie okna cookies...");
  const cookiesAcceptButton = await page.$(
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"
  );
  if (cookiesAcceptButton) {
    console.log("Znaleziono okno cookies, klikam 'Zgadzam się'.");
    await cookiesAcceptButton.click();
    // Poczekaj chwilę na zniknięcie okna z cookies
    await page.waitForTimeout(1000);
  } else {
    console.log("Nie znaleziono okna cookies.");
  }

  // Poczekaj aż strona biżuterii się załaduje w pełni
  console.log("Oczekiwanie na pełne załadowanie strony...");
  await page.waitForLoadState("networkidle", { timeout: 30000 });

  // Pobierz wszystkie linki do produktów
  console.log("Pobieranie linków do produktów...");
  const productLinks = await page.$$eval(
    "div.category-products ul.products-grid li.item a.product-image",
    (links) => links.map((link) => link.href)
  );

  if (productLinks.length === 0) {
    throw new Error("Nie znaleziono towarów.");
  }

  console.log(`Znaleziono ${productLinks.length} produkty.`);

  // Ogranicz liczbę produktów do 1
  const selectedProductLinks = productLinks.slice(0, 1);

  for (const productLink of selectedProductLinks) {
    console.log(`Przejście do produktu: ${productLink}`);
    await page.goto(productLink, { waitUntil: "networkidle" });

    // Pobierz tytuł produktu ze strony towaru
    const productTitle = await page
      .locator('h1[itemprop="name"]')
      .textContent();
    const formattedProductTitle = productTitle?.trim().toLowerCase();
    console.log(`Tytuł produktu: ${formattedProductTitle}`);

    // Znajdź przycisk "Dodaj do koszyka"
    const addToCartButton = await page.$("#addToCartButton");
    if (!addToCartButton) {
      throw new Error("Nie znaleziono przycisku 'Dodaj do koszyka'.");
    }

    console.log("Klikam 'Dodaj do koszyka'.");
    await addToCartButton.click();

    // Poczekaj na załadowanie koszyka
    await page.waitForTimeout(1000);
  }

  // Przejdź bezpośrednio do koszyka
  console.log("Przechodzę do koszyka.");
  await page.goto("https://yes.pl/koszyk", { waitUntil: "networkidle" });

  // Zlokalizuj wszystkie produkty w koszyku
  console.log("Pobieram wszystkie produkty z koszyka.");
  const cartItems = page.locator("div.product-item");

  // Sprawdź, ile produktów jest w koszyku
  const itemCount = await cartItems.count();
  console.log(`Liczba produktów w koszyku: ${itemCount}`);

  if (itemCount === 0) {
    const pageContent = await page.content();
    require("fs").writeFileSync(
      `page-content-${page.context().browser()?.browserType().name()}.html`,
      pageContent
    );
    throw new Error("Koszyk jest pusty.");
  }

  // Zweryfikuj produkty w koszyku
  for (let i = 0; i < itemCount; i++) {
    const cartProductTitle = await cartItems
      .nth(i)
      .locator("h6.product-name a")
      .textContent();
    const formattedCartProductTitle = cartProductTitle?.trim().toLowerCase();

    console.log(`Sprawdzanie towaru nr ${i + 1}: ${formattedCartProductTitle}`);
  }
  await page.waitForTimeout(1000);
  // Sprawdź i zamknij nakładkę, jeśli się pojawi
  console.log("Sprawdzam, czy nie ma nakładek zasłaniających przycisk.");
  const obstructingOverlay = page.locator(".wrapperParent.scale");
  if (await obstructingOverlay.isVisible()) {
    console.log("Nakładka wykryta. Zamykanie jej.");
    // Zamknij nakładkę
    await page.evaluate(() => {
      const overlay = document.querySelector(".wrapperParent.scale");
      if (overlay) {
        overlay.style.display = "none";
      }
    });
    // Poczekaj, aż nakładka zniknie
    await expect(obstructingOverlay).toBeHidden();
  } else {
    console.log("Nie wykryto żadnych nakładek.");
  }

  console.log("Klikam 'Zrealizuj zamówienie'.");
  await page
    .getByRole("button", { name: "Zrealizuj zamówienie" })
    .click({ timeout: 60000 });

  // Zaloguj się na konto
  console.log("Wprowadzam dane logowania.");
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Email lub hasło nie zostały zdefiniowane w zmiennych środowiskowych."
    );
  }

  await page.getByRole("textbox", { name: "Adres e-mail*" }).fill(email);
  await page.getByRole("textbox", { name: "Hasło*" }).fill(password);
  await page.getByRole("button", { name: "Zaloguj" }).click();

  // Przejdź do koszyka po zalogowaniu
  console.log("Wracam do koszyka po zalogowaniu.");
  await page.goto("https://yes.pl/koszyk", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  // Ponownie sprawdź i zamknij nakładkę, jeśli się pojawi
  console.log(
    "Sprawdzam ponownie, czy nie ma nakładek zasłaniających przycisk."
  );
  if (await obstructingOverlay.isVisible()) {
    console.log("Nakładka wykryta. Zamykanie jej.");
    // Zamknij nakładkę
    await page.evaluate(() => {
      const overlay = document.querySelector(".wrapperParent.scale");
      if (overlay) {
        overlay.style.display = "none";
      }
    });
    // Poczekaj, aż nakładka zniknie
    await expect(obstructingOverlay).toBeHidden();
  } else {
    console.log("Nie wykryto żadnych nakładek.");
  }

  // Kliknij "Zrealizuj zamówienie"
  console.log("Finalizacja zamówienia.");
  await page
    .getByRole("button", { name: "Zrealizuj zamówienie" })
    .click({ timeout: 60000 });

  // Zweryfikuj obecność "Polska" w sekcji adresu
  const divSelector = "div.section-address-select"; // Właściwy selektor
  await page.waitForSelector(divSelector);
  const divContent = await page.textContent(divSelector);
  const containsPolska = divContent?.includes("Polska");

  console.log(`Czy sekcja adresu zawiera "Polska"?: ${containsPolska}`);
  expect(containsPolska).toBe(true);

  // Wroc do koszyka oczyscic koszyk
  console.log("Wracam do koszyka aby go oczyscic.");
  await page.goto("https://yes.pl/koszyk", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  console.log("Czyszczenie koszyka.");

  const removeButtons = await page.$$("a.btn-remove.btn-remove2");
  for (const removeButton of removeButtons) {
    const onclickValue = await removeButton.getAttribute("onclick");
    const match = onclickValue?.match(/removeProdClick\('(.+?)'\)/);
    if (match && match[1]) {
      const productId = match[1];
      console.log(`Usuwam produkt o ID: ${productId}`);
      await page.evaluate((id) => {
        removeProdClick(id);
      }, productId);
      // Poczekaj na aktualizację koszyka
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    }
  }

  console.log("Koszyk został wyczyszczony.");

  console.log("Wylogowywanie po teście.");
  await page.goto("https://yes.pl/customer/account/logout/");

  console.log("Test zakończony.");
});
