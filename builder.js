var electronInstaller = require('electron-winstaller');


resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: './release-builds/StreamTools-win32-ia32',
    outputDirectory: '/build/installer64',
    authors: 'Lucas Drufva',
    exe: 'StreamTools.exe'
  });

resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`));