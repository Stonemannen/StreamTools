module.exports = function(grunt) {
    grunt.initConfig({
      'create-windows-installer': {
        ia32: {
          appDirectory: './release-builds/StreamTools-win32-ia32',
          outputDirectory: './dist',
          name: 'StreamTools',
          description: 'StreamTools',
          authors: 'Lucas Drufva',
          exe: 'StreamTools.exe'
        }
      }
    });
  
    grunt.loadNpmTasks('grunt-electron-installer');
  };