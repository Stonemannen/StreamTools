if (require('electron-squirrel-startup')) return;
const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require("fs")
const readJson = require("r-json")
var express = require('express')
var eapp = express()
const request = require('request');
const Discord = require('discord.js');
const appVersion = require('./package.json').version;
const os = require('os').platform();
var http = require('http').Server(eapp);
var io = require('socket.io')(http);
var ioReady = false;

try {
    var config = fs.readFileSync('./config.txt');
    config = JSON.parse(config);
} catch (error) {
    var config = {};
    fs.writeFileSync('./config.txt', config);
}
var hook;
if(config.discord_id){
    try {
        hook = new Discord.WebhookClient(config.discord_id, config.discord_token);
    } catch (error) {
        console.log("fdail")
    }
}


var token;
request.post({url:'https://accounts.google.com/o/oauth2/token', form: {client_id:'814219747250-i5q3vuf907ul877l0he0mt3fh8opdtse.apps.googleusercontent.com', client_secret:'t4xUV1JAOQZiZFT2iD8H68QS', refresh_token: config.token, grant_type:'refresh_token'}}, function(err,httpResponse,body){ 
        console.log(body);
        let jbody = JSON.parse(body);
        token = jbody.access_token;
        console.log("Token: " + token);
        
});


// set ENV
//process.env.NODE_ENV = 'production';

const {app, BrowserWindow, Menu, ipcMain, autoUpdater} = electron;

let mainWindow;
let configWindow;
let oauth2Window;

if(process.env.NODE_ENV == 'production'){
    const server = 'https://your-deployment-url.com';
    const feed = `${server}/update/${process.platform}/${appVersion}`;
    autoUpdater.setFeedURL(feed);
    setInterval(() => {
        autoUpdater.checkForUpdates()
    }, 60000);

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
        const dialogOpts = {
            type: 'info',
            buttons: ['Restart', 'Later'],
            title: 'Application Update',
            message: process.platform === 'win32' ? releaseNotes : releaseName,
            detail: 'A new version has been downloaded. Restart the application to apply the updates.'
        }
  
        dialog.showMessageBox(dialogOpts, (response) => {
            if (response === 0) autoUpdater.quitAndInstall()
        })
    })

    autoUpdater.on('error', message => {
        console.error('There was a problem updating the application')
        console.error(message)
    })
}



// Listen for app to be ready
app.on('ready', function(){
    //create new window
    mainWindow = new BrowserWindow({});
    //load html into window
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol:'file',
        slashes: true
    }));

    mainWindow.on('closed', function(){
        app.quit();
    });
    //buil meny from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    //insert menu
    Menu.setApplicationMenu(mainMenu);

    
});

function createConfigWindow(){
    //create new window
    configWindow = new BrowserWindow({width:400, height:400});
    //load html into window
    configWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'config.html'),
        protocol:'file',
        slashes: true
    }));

    configWindow.on('close', function(){
        configWindow = null;
    });
}

function createOauth2Window(){
    //create new window
    oauth2Window = new BrowserWindow({});

    //load html into window
    oauth2Window.loadURL("https://accounts.google.com/o/oauth2/auth?client_id=814219747250-i5q3vuf907ul877l0he0mt3fh8opdtse.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A8081%2Foauth2callback&scope=https://www.googleapis.com/auth/youtube&response_type=code&access_type=offline");

    oauth2Window.on('close', function(){
        oauth2Window = null;
    });
}

// catch config:api
ipcMain.on('config:api', function(e, api){
    console.log("test")
    createOauth2Window();

})

ipcMain.on('discord:url', function(e, url){
    if(url){
        config.discord_url = url;
        fs.writeFileSync('./config.txt', JSON.stringify(config));
        console.log(url);
        request.get(url, function(err,httpResponse,body){
            body = JSON.parse(body);
            console.log(body);
            config.discord_id = body.id;
            config.discord_token = body.token;
            fs.writeFileSync('./config.txt', JSON.stringify(config));
        });
    }
    configWindow.close();

})

ipcMain.on('sub:goal', function(e, goal){
    config.subGoal = goal;
    fs.writeFileSync('./config.txt', JSON.stringify(config));
});

ipcMain.on('channel:id', function(e, id){
    if(id){
        request.get({url:'https://www.googleapis.com/youtube/v3/channels?part=snippet&id=' + id, 'auth': {'bearer': token}}, function(err,httpResponse,body){ 
            body = JSON.parse(body);
            config.channelId = id;
            config.channelName = body.items[0].snippet.title;
            console.log(id);
            fs.writeFileSync('./config.txt', JSON.stringify(config));
        })
        
    }
});

var chatId;

ipcMain.on('stream:id', function(e, id){
    console.log(id);
    if(config.discord_id){
        hook.send(config.channelName + ' is now live: https://www.youtube.com/watch?v=' + id);
        console.log("disc sent");
    }
    request.get({url:'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&id=' + id, 'auth': {'bearer': token}}, function(err,httpResponse,body){ 
        try {
            console.log("b" + body);
            body = JSON.parse(body);
            //let jbody = JSON.parse(body);
            //token = jbody.refresh_token;
            chatId = body.items[0].snippet.liveChatId;
            liveChatStart()   
        } catch (error) {
                
        }    
    });
    
})

ipcMain.on('values', function(e, id){
    e.sender.send('defaultChannelId', config.channelId);
    e.sender.send('defaultDiscordUrl', config.discord_url);
    e.sender.send('defaultSubGoal', config.subGoal);
});

// create menu template
const mainMenuTemplate = [
    {
        label:'File', 
        submenu:[
            {
                label: 'Config',
                click(){
                    createConfigWindow();
                }
            },
            {
                label:'Quit',
                accelerator: process.platform == 'darwin' ? 'Command+Q' : 
                'Ctrl+Q',
                click(){
                    app.quit();
                }
            } 
        ]
    }
];

if(process.platform == 'darwin'){
    mainMenuTemplate.unshift({});
}

// add developer tools item if not in prod
if(process.env.NODE_ENV !== 'production'){
    mainMenuTemplate.push({
        label: 'Dev Tools',
        submenu:[
            {
                label: 'Toggle DevTools',
                accelerator: process.platform == 'darwin' ? 'Command+I' : 
                'Ctrl+I',
                click(item, focusedWindow){
                    focusedWindow.toggleDevTools();
                }
            },
            {
                role: 'reload'
            }
        ]
    })
}

var pollingIntervalMillis;
var pageToken;


function liveChatStart(){
    try{
        request.get({url:'https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet&liveChatId=' + chatId, 'auth': {'bearer': token}}, function(err,httpResponse,body){
            console.log(body);    
            body = JSON.parse(body);
            pollingIntervalMillis = parseInt(body.pollingIntervalMillis);
            pageToken = body.nextPageToken;
            setTimeout(liveChat,pollingIntervalMillis);
        });
    }
    catch(err){

    }
    
}

function liveChat(){
    try {
        request.get({url:'https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet&liveChatId=' + chatId + '&pageToken=' + pageToken, 'auth': {'bearer': token}}, function(err,httpResponse,body){
            console.log(body);
            body = JSON.parse(body);
            pollingIntervalMillis = parseInt(body.pollingIntervalMillis);
            pageToken = body.nextPageToken;
            if(body.items.length > 0){
                mainWindow.webContents.send('message', body.items[body.items.length - 1].snippet.textMessageDetails.messageText);
            }
            setTimeout(liveChat,pollingIntervalMillis);
        });
    } catch (err) {
        
    }
    
}


//server
eapp.get('/oauth2callback', function (req, res) {
    res.send(200);
    mainWindow.webContents.send('config:api', req.query.code);
    console.log(req.query.code);
    oauth2Window.close();
    
    request.post({url:'https://accounts.google.com/o/oauth2/token', form: {code: req.query.code, client_id:'814219747250-i5q3vuf907ul877l0he0mt3fh8opdtse.apps.googleusercontent.com', client_secret:'t4xUV1JAOQZiZFT2iD8H68QS', redirect_uri:'http://localhost:8081/oauth2callback', grant_type:'authorization_code'}}, function(err,httpResponse,body){ 
        console.log(body);
        let jbody = JSON.parse(body);
        config.token = jbody.refresh_token
        fs.writeFileSync('./config.txt', JSON.stringify(config));
    });

});
eapp.get('/message/:message', function (req, res) {
    res.sendStatus(200);
    mainWindow.webContents.send('message', req.params.message);
});

var subsocket = false;

eapp.get('/subs', function (req, res) {
    res.sendFile(path.join(__dirname + '/subs.html'));
    subsocket = true;
    
});
  
function subs(){
    request.get({url:'https://www.googleapis.com/youtube/v3/channels?part=statistics&id=' + config.channelId, 'auth': {'bearer': token}}, function(err,httpResponse,body){
        body = JSON.parse(body);
        var subscribers = parseInt(body.items[0].statistics.subscriberCount);
        io.emit('subs', subscribers);
        setTimeout(subs,1000);
    });
}

io.on('connection', function(socket){
    if(subsocket){
        request.get({url:'https://www.googleapis.com/youtube/v3/channels?part=statistics&id=' + config.channelId, 'auth': {'bearer': token}}, function(err,httpResponse,body){
            body = JSON.parse(body);
            var subscribers = parseInt(body.items[0].statistics.subscriberCount);
            io.emit('subs', subscribers);
            io.emit('goal', config.subGoal);
            setTimeout(subs,1000);
        });
    }
});


http.listen(8081);