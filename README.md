# Клешневар — односторінковий сайт

Лендінг з кошиком і замовленнями. Секрети в git не кладуться.

## Секрети — що куди

| Дані | Де зберігати | У GitHub? |
|---|---|---|
| Назва, меню, ціни, телефон, адреса | `config.js` | так (це публічна вітрина) |
| Firebase web-конфіг | `config.secrets.js` | **ні** |
| Токен Telegram-бота | `functions/.env` | **ні** |
| ID адмінів бота | `functions/.env` | **ні** |

Скопіюйте шаблони один раз:

```bash
cp config.secrets.example.js config.secrets.js
cp functions/.env.example functions/.env
```

Далі заповніть свої значення. Ці два файли вже в `.gitignore`.

Веб-ключ Firebase у браузері все одно видно — захист замовлень дає **Firestore rules**, а не приховування apiKey. Токен бота на сайт не потрапляє ніколи.

## Запуск на ПК

```bash
cd kleshnevar-site
npx --yes serve -p 5173
```

http://localhost:5173

## Firebase + Telegram

1. Firebase Console → Firestore.
2. Ключі веба — лише в `config.secrets.js`.
3. Правила — файл `firestore.rules` (створювати замовлення можна, читати з інтернету — ні).
4. Бот: @BotFather. Свій id: @userinfobot.
5. У `functions/.env`:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_IDS=111111111,222222222
```

6. Деплой функції:

```bash
firebase deploy --only functions,firestore:rules
```

Або секрети Firebase:

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_ADMIN_IDS
```

Повідомлення йдуть тільки на ID зі списку.

Без Firebase замовлення пишуться в `localStorage` браузера.

## GitHub Pages

Не комітьте `config.secrets.js` і `functions/.env`.  
Перевірте перед пушем:

```bash
git status
```

У списку не повинно бути цих файлів.
