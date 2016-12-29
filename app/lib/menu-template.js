const electron = require('electron');
const {dialog} = electron;
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const fs = require('fs');
const path = require('path');

var OK_TYPES = require('./file-types.json').types;




const menuTemplate = [
    {
      label: "File",
      submenu: [
          {
            label: 'Open...',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              console.log('Open Clicked');

              var files = dialog.showOpenDialog({properties: ['openFile', 'openDirectory', 'multiSelections']});
              if(files && files.length){
                var mapd = files.map(function(fp){
                  var type = OK_TYPES.find(function(it){ return it.extensions.indexOf(path.extname(fp).substr(1)) > -1; }).name;
                  return {path:fp, name:path.basename(fp), type:type, size: fs.statSync(fp).size};
                });
                console.log(mapd);
                BrowserWindow.getFocusedWindow().webContents.send('media.select', mapd);
              }
            }
          },
          {
              label: 'New Playlist',
              click: () => {
                console.log('Playlist Clicked');
                BrowserWindow.getFocusedWindow().webContents.send('playlist.create');
              }
          }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          role: 'undo'
        },
        {
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          role: 'cut'
        },
        {
          role: 'copy'
        },
        {
          role: 'paste'
        },
        {
          role: 'pasteandmatchstyle'
        },
        {
          role: 'delete'
        },
        {
          role: 'selectall'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          role: 'reload'
        },
        {
          role: 'toggledevtools'
        },
        {
          type: 'separator'
        },
        {
          role: 'resetzoom'
        },
        {
          role: 'zoomin'
        },
        {
          role: 'zoomout'
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen'
        }
      ]
    }
];
if (process.platform === 'darwin') {
  menuTemplate.unshift({
    label: app.getName(),
    submenu: [
      {
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        role: 'hide'
      },
      {
        role: 'hideothers'
      },
      {
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        role: 'quit'
      }
    ]
  })
  // Edit menu.
  menuTemplate[1].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking'
        },
        {
          role: 'stopspeaking'
        }
      ]
    }
  )
  // Window menu.
  menuTemplate[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize'
    },
    {
      label: 'Zoom',
      role: 'zoom'
    },
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  ]
}
module.exports = menuTemplate;
