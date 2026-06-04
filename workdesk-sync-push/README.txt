清单小桌 - 电脑手机同步版

这个版本用于电脑和手机同步同一份清单。

一、本机测试

1. 电脑和手机连接同一个 Wi-Fi。
2. 双击 start-wifi-sync-test.cmd。
3. 黑色窗口不要关闭。
4. 电脑打开：
   http://localhost:8788/?room=my-workdesk
5. 手机打开黑色窗口里的 192.168 开头地址。
6. 电脑添加一条清单，手机会同步出现。
7. 手机添加一条清单，电脑也会同步出现。

二、电脑桌面同步版

如果桌面图标闪一下打不开，请重新双击：

create-local-test-shortcut.cmd

它会重新生成桌面图标：

Workdesk Sync

以后双击这个桌面图标，会自动启动本机同步服务，然后打开独立窗口。

三、手机访问不了时

先双击：

allow-phone-access.cmd

如果弹出管理员窗口，请点允许。
然后重新运行 start-wifi-sync-test.cmd，再用手机打开 192.168 开头地址。

四、自己多设备同步

你自己的电脑和手机要使用同一个 room。

例如：

http://localhost:8788/?room=my-workdesk
http://192.168.0.247:8788/?room=my-workdesk

同一个 room 就是同一份数据。

五、分享给朋友

不要把你的 my-workdesk 链接直接发给朋友。
否则朋友会看到并修改你的清单。

现在应用右上角的 + 按钮，会生成一个朋友独立链接。
朋友使用这个链接，会进入自己的新 room，不会同步你的数据。

如果你正式部署到了 HTTPS，也同样如此：

你自己用：
https://你的网址/?room=my-workdesk

朋友用：
点击右上角 + 生成朋友独立链接。

六、正式上线

本机测试只能在同一个 Wi-Fi 下同步。

如果你希望手机在外面也能和电脑同步，需要把这个文件夹部署到 Railway、Render 或云服务器。

上线步骤看：

DEPLOY_STEP_BY_STEP.txt

七、提醒说明

本地 Wi-Fi 测试主要验证同步。
真正的手机后台推送提醒，需要 HTTPS 部署后再测试。
