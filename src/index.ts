import {Page} from "puppeteer";

require('dotenv').config();
import {usageOptions, cmdOptions} from "./cli-config";

const puppeteer = require("puppeteer");
const cmdArgs = require('command-line-args');
const cmdUsage = require('command-line-usage');
const fs = require('fs').promises;

const usage = cmdUsage(usageOptions);
const args = cmdArgs(cmdOptions);

const {game, timeout, verbose, help, proxy, file} = args
const headless = !args['no-headless'];

if (help || !(game || file)) {
    console.log(usage);
    process.exit(0);
}

if (!process.env.TWITCH_CHROME_EXECUTABLE) {
    throw new Error('TWITCH_CHROME_EXECUTABLE not set')
}
if (!process.env.TWITCH_AUTH_TOKEN) {
    throw new Error('TWITCH_AUTH_TOKEN not set')
}

const directoryUrl = `https://www.twitch.tv/directory/game/${game}?tl=c2542d6d-cd10-4532-919b-3d19f30a768b`;

function formatLog(msg: string) {
    return `[${new Date().toUTCString()}] ${msg}`;
}

function info(msg: string) {
    console.info(formatLog(msg));
}

function vinfo(msg: string) {
    if (!verbose) return;
    console.debug(`[VERBOSE] ${formatLog(msg)}`);
}

function warn(msg: string) {
    console.warn(`[WARNING] ${formatLog(msg)}`);
}

async function initTwitch(page: Page) {
    info('正在跳转至Twitch');
    await page.goto('https://twitch.tv', {
        waitUntil: ['networkidle2', 'domcontentloaded']
    });
    info('正在配置流媒体设置...');
    await page.evaluate(() => {
        localStorage.setItem('mature', 'true');
        localStorage.setItem('video-muted', '{"default":true}');
        localStorage.setItem('volume', '0.0');
        localStorage.setItem('video-quality', '{"default":"160p30"}');
    });
    info('正在使用auth-token登录...')
    await page.setCookie(
        {
            name: 'auth-token',
            value: process.env.TWITCH_AUTH_TOKEN
        }
    );
}

let buffering = 0;
let prevDuration = -1;

async function findRandomChannel(page: Page) {
    await page.goto(directoryUrl, {
        waitUntil: ['networkidle2', 'domcontentloaded']
    });
    const aHandle = await page.waitForSelector('a[data-a-target="preview-card-image-link"]', {timeout: 0});
    const channel = await page.evaluate(a => a.getAttribute('href'), aHandle);
    info('频道确认: 正在跳转...');
    await page.goto(`https://twitch.tv${channel}`, {
        waitUntil: ['networkidle2', 'domcontentloaded']
    });
}

let list: string[];

async function readList() {
    info(`正在解析频道列表: ${file}`);
    const read = await fs.readFile(file, {encoding: "utf-8"});
    list = read.split(/\r?\n/).filter((s: string) => s.length !== 0);
    info(`${list.length} 已有频道: ${list.join(', ')}`);
}

async function findChannelFromList(page: Page) {
    if (!list) await readList();
    for (let channel of list) {
        vinfo(`Trying ${channel}`)
        await page.goto(`https://twitch.tv/${channel}`, {
            waitUntil: ['networkidle2', 'domcontentloaded']
        });
        const live = !(await isLive(page)).notLive;
        vinfo(`Channel live: ${live}`);
        if (!live) vinfo('Channel offline, trying next channel');
        else {
            if (game) {
                const gameLink = await page.waitForSelector('a[data-a-target="stream-game-link"]', {timeout: 0});
                const href = await page.evaluate(a => a.getAttribute('href'), gameLink);
                const streamingGame = href.toLowerCase().endsWith(`/${game.toLowerCase()}`);
                vinfo(`Channel streaming the given game: ${streamingGame}`);
                if (!streamingGame) continue;
            }
            info('发现在线频道！');
            return;
        }
    }
    info('频道已下线！请稍后重试');
}

async function findCOnlineChannel(page: Page) {
    buffering = 0;
    prevDuration = -1;
    info(`正在寻找 ${game} 在线频道...`);
    if (file) await findChannelFromList(page);
    else await findRandomChannel(page);
}

async function checkInventory(inventory: Page) {
    await inventory.goto('https://twitch.tv/inventory', {
        waitUntil: ['networkidle2', 'domcontentloaded']
    });
    const claimButtons = (await inventory.$$('button[data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"]'));
    vinfo(`${claimButtons.length} claim buttons found${claimButtons.length > 0 ? '!' : '.'}`);
    for (const claimButton of claimButtons) {
        info('找到宝藏啦！是我的啦！')
        await new Promise(resolve => setTimeout(resolve, 1000));
        await claimButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function isLive(mainPage: Page) {
    const status = await mainPage.$$eval('a[status]', li => li.pop()?.getAttribute('status'));
    const videoDuration = await mainPage.$$eval('video', videos => (videos.pop() as HTMLVideoElement)?.currentTime);
    const raid = mainPage.url().includes('?referrer=raid');
    vinfo(`Current url: ${mainPage.url()}`);
    vinfo(`Channel status: ${status}`);
    vinfo(`Video duration: ${videoDuration}`);
    const notLive = status !== 'live' || videoDuration === 0;
    return {videoDuration, notLive, raid};
}

async function checkLiveStatus(mainPage: Page) {
    const {videoDuration, notLive, raid} = await isLive(mainPage);
    if (notLive || raid) {
        info('频道离线');
        await findCOnlineChannel(mainPage);
        return;
    }
    if (videoDuration === prevDuration) {
        warn('流媒体正在缓冲或已离线. 若持续存在将会在下个周期寻找新频道');
        if (++buffering > 1) {
            info('频道离线或视频流正在缓冲');
            await findCOnlineChannel(mainPage);
            return;
        }
    } else {
        buffering = 0;
    }
    prevDuration = videoDuration;
}

async function runTimer(mainPage: Page, inventory: Page) {
    vinfo('Timer function called')
    await checkInventory(inventory);
    await checkLiveStatus(mainPage);
    setTimeout(runTimer, timeout, mainPage, inventory);
}

async function run() {
    info('应用启动中...');
    const browser = await puppeteer.launch({
        executablePath: process.env.TWITCH_CHROME_EXECUTABLE,
        headless: headless,
        args: proxy ? [`--proxy-server=${proxy}`] : []
    });
    const mainPage = (await browser.pages())[0];
    await mainPage.setViewport({width: 1280, height: 720})
    await initTwitch(mainPage);

    const inventory = await browser.newPage();
    await inventory.setViewport({width: 1280, height: 720})
    await mainPage.bringToFront();

    await findCOnlineChannel(mainPage);
    setTimeout(runTimer, timeout, mainPage, inventory);
}

run().then(() => {
    // Nothing
});


// author:AlexSterk
// interpreter:CherryGOO
