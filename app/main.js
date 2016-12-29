

const electron = require('electron')

// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
const Menu = electron.Menu;

const path = require('path')
const url = require('url')
const fs = require('fs')
//const streams = require('memory-streams');

const transcoder = require('./lib/transcoder.js')

app.setPath("appData", (app.getPath("appData")+'/Extracast'));

// transcoder.on('progress', function(params){
//   mainWindow.webContents.send("ffmpeg-update", params);
// })
const ipcMain = electron.ipcMain;
//let ffnag;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
ipcMain.on('quit-it-all', function(event) {
  console.log("QUIT!");
  //if(ffnag) ffnag.destroy();
  if(app) app.quit();
  event.returnValue = 'killed'
});
ipcMain.on('do-install-ffmpeg', function(event) {
  console.log("INSTALL!!");
  transcoder.install(function(installed){
    event.sender.send('ffmpeg-installed', installed)
    console.log("INSTALLED", installed);
  });
});



function createWindow () {

  const menu = Menu.buildFromTemplate(require('./lib/menu-template.js'));
  Menu.setApplicationMenu(menu);

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1280, height: 720, minWidth:800, minHeight:600, titleBarStyle:"hidden-inset"})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'client/html/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
  // mainWindow.on('show', function(){
  //
  //   //if ffmpeg not installed
  //   if(!transcoder.exists()){
  //
  //     ffnag = new BrowserWindow({parent: mainWindow, width: 500, height: 300, modal: true, show: true})
  //
  //     ffnag.loadURL(url.format({
  //       pathname: path.join(__dirname, 'client/html/tpl/install-ffmpeg.html'),
  //       protocol: 'file:',
  //       slashes: true
  //     }))
  //   }
  //
  // })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// app.on('before-quit',function(){
//   mainWindow.webContents.send("chromecast.quit");
//   console.log("Quitting...");
// });
// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    transcoder.kill();
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
