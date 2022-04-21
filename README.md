# Twitch Drop Grabber
十分感谢AlexSterk大佬的这个项目，像我这种低技术力的只能搬运和简单的汉化一下

Node.js application that watches Twitch streams and collects [Drops](https://help.twitch.tv/s/article/mission-based-drops?language=en_US). 
When the stream it's watching goes offline, it finds a new one. Great for running in the background: **Set and forget**.

----

## 如何安装或者使用

0. 请先确保您的电脑环境中已经安装Node.js、npm以及Google Chrome
1. 克隆本项目
2. 命令框运行 `npm install`
3. 命令框运行 `npm run build` 来编译TS文件
4. 设置环境变量 [环境变量](#环境变量)
5. 通过 `npm start -- "GAME-NAME"` 命令来运行本项目(GAME-NAME 为您要进行获取掉宝活动的游戏名称)
   
更多选项详见 `npm start -- --help`
   
## 环境变量

1.新建 `.env` 文件，相关示例可查阅 [.env.example](/.env.example)
2.获取您的Twitch验证令牌，可以在浏览器登录Twitch后通过F12进入控制台，在cookie中找到自己账号的auth_token。如果您的auth_token是 `dasdsfadafsgafsdf`，请在`.env`中填写 `TWITCH_AUTH_TOKEN = dasdsfadafsgafsdf`
请在每次更新 `.env` 文件后重新运行 `npm run build`

3.获取您的Google Chrome安装路径，通常你可以再Chrome的地址栏中输入 `chrome://version/` ，并通过可执行文件路径找到自己的安装路径。如果您的可执行文件路径为 `C:\Program Files\Google\Chrome\Application\chrome.exe`，请在`.env`中填写 `TWITCH_CHROME_EXECUTABLE = "C:\Program Files\Google\Chrome\Application\Chrome.exe"`

**注意：根据相关安全协议，在您的token失效或登录失败后，请重新登录获取token！**

## 免责声明
本项目仅仅是分流并将说明汉化的[AlexSterk/TwitchDropGrabber](https://github.com/AlexSterk/TwitchDropGrabber)项目
更多内容[请点击这里查看更多](https://github.com/AlexSterk/TwitchDropGrabber)

如果我的行为对您的权益造成了伤害，请联系我删除此项目
If my behavior has harmed your rights and interests, please contact me to delete this item