let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let argv = require('yargs').argv
let net = require('net');
let archiver = require('archiver')
let JsonSocket = require('json-socket');
let http = require('http')
let request = require('request')
require('songbird')

let storage_dir  = argv.dir || process.cwd()
const CLIENT_DIR = path.resolve(path.join(storage_dir, "/client"))

var port = 8001; //The same port that the server is listening on
var host = '127.0.0.1';
var socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);
socket.on('connect', function() { //Don't send until we're connected
    console.log("connect to tcp server")
    socket.sendMessage({verb: 'init'});
    socket.on('message', async function(message) {
        if(message.verb === 'init') {
          await initdir(message.body) 
        } else if(message.verb === 'mkdir') {
          await mkdir(message.path)
        } else if(message.verb === 'delete') {
          await rm(message.path)
        } else if(message.verb === 'update') {
          console.log(message.body)
          await update(message.path, message.body)
        }
    });
});

async function mkdir(dirpath) {
   mkdirp.promise(path.resolve(path.join(CLIENT_DIR, dirpath))).catch(e => console.log(e))
   console.log("mkdir " + dirpath)
}

async function rm(filepath) {
   rimraf.promise(path.resolve(path.join(CLIENT_DIR, filepath))).catch(e => console.log(e))
   console.log("rm -rf " + filepath)
}

async function update(filepath, body) {
  await mkdir(path.dirname(filepath))
  let fpath = path.resolve(path.join(CLIENT_DIR, filepath))
  fs.promise.writeFile(fpath, body, {flag : 'w'}).catch(e => console.log(e))
  console.log("create/update " + filepath)
}

async function initdir(dirpath, body) {
}


