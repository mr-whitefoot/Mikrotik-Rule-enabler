Создаем пользователя api на роутере



#Включение доступа к API 
/ip/service set www-ssl certificate=webfig disabled=no  

Генерируем сертификат
/certificate add name=ca-cert common-name=ca days-valid=3650 key-size=2048 key-usage=key-cert-sign,crl-sign
/certificate sign ca-cert   
/certificate add name=webfig common-name=ssl_sert days-valid=3650 key-size=2048
/certificate sign webfig ca=ca-cert 


#1. Включаем поддержку контейнеров (если ещё не включено):  
/system/device-mode/update container=yes
Роутер попросит физически нажать кнопку reset.

#2. Создаём сетевой интерфейс для контейнера:
/interface/veth/add name=veth1 address=172.17.0.2/24 gateway=172.17.0.1   

#3. Создаём bridge и вешаем на него veth:
/interface/bridge/add name=containers 
/interface/bridge/port/add bridge=containers interface=veth1   

#4. Форматируем флешку
/disk format usb1 file-system=ext4 label=FlashDrive

#5. Установливаем временную папку для контейнера на USB 
/container/config/set registry-url=https://registry-1.docker.io tmpdir=usb1/tmp    

#6. Собираем образ на компе
docker buildx build --platform linux/arm/v7 -t mikrotik-route:latest --output type=docker .

7. Упаковываем в архив
docker save mikrotik-route:latest > mikrotik-route.tar

8. Заливаем образ на mikrotik
scp mikrotik-route.tar admin@<ip_роутера>:/usb1/

#9. Создаем envlist на роутере:
/container/envs/add name=mikrotik-route key=MT_HOST value=<ip_роутера>
/container/envs/add name=mikrotik-route key=MT_USER value=vpnapi
/container/envs/add name=mikrotik-route key=MT_PASS value=yourpassword

10. Добавляем контейнер из .tar файла:
/container/add file=usb1/mikrotik-route.tar interface=veth1 root-dir=usb1/container start-on-boot=yes envlist=mikrotik-route

Подождать — импорт занимает какое то время, затем будет распаковка. Смотрим статус:
/container/print
Ждём пока статус сменится с extracting на stopped.

11. Запускаем контейнер
/container/start 0


12. Firewall — доступ только из LAN:
/ip/firewall/filter/add chain=forward dst-port=8080 src-address=192.168.88.0/24 protocol=tcp action=accept comment="Allow LAN to container 8080"
/ip/firewall/filter/add chain=forward dst-port=8080 protocol=tcp action=drop comment="Drop WAN to container 8080"


13 Прописываем маршрут для доступа из локальной сети
1. Добавь маршрут из сети контейнера в LAN:
routeros
/ip/route/add dst-address=10.0.0.0/24 gateway=172.17.0.1

2. Разреши контейнеру обращаться к REST API роутера (порт 443) через input chain:
routeros
/ip/firewall/filter/add chain=input src-address=172.17.0.0/24 protocol=tcp dst-port=443 action=accept comment="Allow container to REST API"

Поставь это правило выше дефолтного drop — укажи место явно:
routeros
/ip/firewall/filter/move [find comment="Allow container to REST API"] destination=0



После всего проделанного панель должна быть доступна по адресу
http://172.17.0.2:8080