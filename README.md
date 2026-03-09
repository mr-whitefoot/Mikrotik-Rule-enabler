# MikroTik Routing Rules Enabler

Инструкция по установке и настройке контейнера для управления правилами маршрутизации на роутерах MikroTik.

## Шаг 1: Подготовка роутера и API
Для работы приложения необходимо создать пользователя и настроить безопасный доступ к REST API.

1. **Создание пользователя:**
   Создайте пользователя с правами на чтение и запись (api).
   Ограничьте доступ пользователя по подсети, вашей локальной сети и 172.17.0.0/24 - сети контейнеров(сеть будет создана ниже). 

2. **Включение доступа к API:**
   ```bash
   /ip/service set www-ssl certificate=webfig disabled=no
   ```

3. **Генерация сертификатов (SSL):**
   ```bash
   /certificate add name=ca-cert common-name=ca days-valid=3650 key-size=2048 key-usage=key-cert-sign,crl-sign
   /certificate sign ca-cert
   /certificate add name=webfig common-name=ssl_sert days-valid=3650 key-size=2048
   /certificate sign webfig ca=ca-cert
   ```

## Шаг 2: Настройка среды для контейнеров
Перед установкой убедитесь, что на вашем роутере включена поддержка контейнеров и подготовлен USB-накопитель.

1. **Включение поддержки контейнеров:**
   ```bash
   /system/device-mode/update container=yes
   ```
   *После выполнения команды роутер потребует физического подтверждения (нажатия кнопки Reset).*

2. **Подготовка USB-накопителя:**
   ```bash
   /disk format usb1 file-system=ext4 label=FlashDrive
   ```

3. **Настройка системных путей:**
   ```bash
   /container/config/set registry-url=https://registry-1.docker.io tmpdir=usb1/tmp
   ```

## Шаг 3: Сетевая настройка
Создание виртуального интерфейса и моста для работы контейнера в сети роутера.

1. **Создание виртуального интерфейса (VETH):**
   ```bash
   /interface/veth/add name=veth1 address=172.17.0.2/24 gateway=172.17.0.1
   ```

2. **Создание Bridge и привязка интерфейса:**
   ```bash
   /interface/bridge/add name=containers
   /interface/bridge/port/add bridge=containers interface=veth1
   ```

## Шаг 4: Сборка и деплой образа
Сборка производится на компьютере, после чего готовый образ копируется на роутер.

1. **Сборка образа (под архитектуру ARM/v7):**
   ```bash
   docker buildx build --platform linux/arm/v7 -t mikrotik-route:latest --output type=docker .
   ```

2. **Упаковка в архив:**
   ```bash
   docker save mikrotik-route:latest > mikrotik-route.tar
   ```

3. **Копирование образа на MikroTik:**
   ```bash
   scp mikrotik-route.tar admin@<ip_роутера>:/usb1/
   ```

## Шаг 5: Запуск контейнера на роутере

1. **Настройка переменных окружения (Envlist):**
   ```bash
   /container/envs/add name=mikrotik-route key=MT_HOST value=<ip_роутера>
   /container/envs/add name=mikrotik-route key=MT_USER value=api
   /container/envs/add name=mikrotik-route key=MT_PASS value=api_user_password
   ```

2. **Импорт и установка контейнера:**
   ```bash
   /container/add file=usb1/mikrotik-route.tar interface=veth1 root-dir=usb1/container start-on-boot=yes envlist=mikrotik-route
   ```
   *Дождитесь завершения распаковки. Статус должен смениться с `extracting` на `stopped`.*

3. **Запуск:**
   ```bash
   /container/start [find name="mikrotik-route"]
   ```

## Шаг 6: Настройка безопасности и маршрутов

1. **Настройка Firewall (доступ только из LAN):**
   ```bash
   /ip/firewall/filter/add chain=forward dst-port=8080 src-address=<ip_роутера>/24 protocol=tcp action=accept comment="Allow LAN to container 8080"
   /ip/firewall/filter/add chain=forward dst-port=8080 protocol=tcp action=drop comment="Drop WAN to container 8080"
   ```

2. **Разрешение контейнеру обращаться к REST API роутера:**
   ```bash
   /ip/firewall/filter/add chain=input src-address=172.17.0.0/24 protocol=tcp dst-port=443 action=accept comment="Allow container to REST API"
   /ip/firewall/filter/move [find comment="Allow container to REST API"] destination=0
   ```

3. **Маршрутизация:**
   ```bash
   /ip/route/add dst-address=<сеть_роутера>/24 gateway=172.17.0.1
   ```

---
**Готово!** Панель управления будет доступна по адресу:  
`http://172.17.0.2:8080`
