## 1.6.7

- Запуск от имени администратора на уровне манифеста: добавлен `requestedExecutionLevel: requireAdministrator` в бинарник `UzurNet.exe`, благодаря чему Windows запрашивает UAC автоматически при каждом запуске приложения
- Мульти-методная проверка прав администратора: устранён ложный сбой `net session` (происходивший при отключенной службе LanmanServer). Теперь используются независимые системные проверки через `fsutil`, `fltmc` и PowerShell API
- Исправлено зацикливание окна требования прав администратора при перезапуске приложения
### Ссылки для скачивания:

#### Windows 10/11 (64-bit):

<a href="https://github.com/zwanter/uzurnet/releases/download/v1.6.7/UzurNet_x64-setup.exe"><img src="https://img.shields.io/badge/EXE-default?style=flat&logo=windows&label=%D0%A3%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D1%89%D0%B8%D0%BA%20(64-bit)"></a> <a href="https://github.com/zwanter/uzurnet/releases/download/v1.6.7/UzurNet_x64-portable.7z"><img src="https://img.shields.io/badge/7Z-default?style=flat&logo=windows&label=%D0%9F%D0%BE%D1%80%D1%82%D0%B0%D1%82%D0%B8%D0%B2%D0%BD%D0%B0%D1%8F%20%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D1%8F%20(64-bit)"></a>