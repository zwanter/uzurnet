<div align="center">
  <img src="docs/images/logo.png" width="128" height="128" alt="UzurNet Logo" />
  <h1>UzurNet</h1>
  <p><strong>Современный, быстрый и элегантный прокси-клиент для Windows 11</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows%2011-0078D4?style=flat-square&logo=windows11&logoColor=white" alt="Windows 11" />
    <img src="https://img.shields.io/badge/Core-Mihomo-10B981?style=flat-square" alt="Mihomo Core" />
    <img src="https://img.shields.io/badge/UI-Fluent%20Acrylic-06B6D4?style=flat-square" alt="Fluent Design" />
    <img src="https://img.shields.io/badge/Version-v1.6.0-emerald?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License" />
  </p>
</div>

---

## 🌟 Особенности

- 💎 **Win11 Fluent Design**: Нативный акриловый интерфейс с поддержкой Mica, адаптивным сайдбаром и плавной анимацией движения карточек.
- ⚡ **Smart Mesh Network**: Умное автоматическое переключение на сервер с наилучшим пингом без «пинг-понга» (EMA-сглаживание задержки + гистерезис).
- 🛡️ **Аварийный Watchdog**: Непрерывный мониторинг активного узла с автоматическим переходом на резервный сервер при таймауте и сбросом зависших TCP-сессий.
- 🚀 **HTTP Keep-Alive туннель**: Постоянное быстрое соединение с ядром без накладных расходов на открытие сокетов Windows.
- 🎯 **TUN & System Proxy**: Полноценный TUN-режим с поддержкой Fake-IP, перехватом DNS и нулевыми утечками трафика.
- 📊 **Рейтинг стабильности узлов**: Динамический скоринг надёжности и аптайма для каждого сервера прямо на карточке.
- 🌐 **Широкая поддержка протоколов**: VLESS, Hysteria 2, Shadowsocks, VMess, Trojan, TUIC и WireGuard.

---

## 📥 Установка

Актуальные сборки доступны на странице [Releases](https://github.com/zwanter/uzurnet/releases):

- **Установщик (Setup)**: `UzurNet_x64-setup.exe` (автоматическая установка, создание ярлыков, интеграция в систему).
- **Портативная версия (Portable)**: `UzurNet_x64-portable.7z` (не требует установки, все данные хранятся рядом с программой).

---

## 🛠️ Сборка из исходников

Требования:
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- Windows 10/11 x64

```bash
# 1. Клонирование репозитория
git clone https://github.com/zwanter/uzurnet.git
cd uzurnet

# 2. Установка зависимостей
pnpm install

# 3. Запуск в режиме разработки
pnpm run dev

# 4. Сборка установщика для Windows
pnpm run build:win
```

---

## 📄 Лицензия

Распространяется под лицензией [GPL-3.0](LICENSE).
