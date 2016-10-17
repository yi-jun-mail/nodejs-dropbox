var fs = require('fs');
var archiver = require('archiver');

var archive = archiver.create('zip', {});
var output = fs.createWriteStream(__dirname + '/zip_folder.zip');

archive.pipe(output);
archive
  .directory(__dirname + '/server')
  .finalize();
