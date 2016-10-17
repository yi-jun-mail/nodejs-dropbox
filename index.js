#!/usr/bin/env babel-node

/**
 run npm install  express morgan bluebird-nodeify rimraf mime-types mkdirp songbird --save
 first to install dependency into package.json and node_modules
*/

let fs = require('fs')
let path = require('path')
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let rimraf = require('rimraf')
let mime = require('mime-types')
let mkdirp = require('mkdirp')
let argv = require('yargs').argv
let net = require('net');
let archiver = require('archiver')
let JsonSocket = require('json-socket');

require('songbird')

const HOST = '127.0.0.1';
const TCP_PORT = 8001;

let storage_dir  = argv.dir || process.cwd()
const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const SERVER_DIR = path.resolve(path.join(storage_dir, "/server"))
const CLIENT_DIR = path.resolve(path.join(storage_dir, "/client"))

let app = express()
var server = net.createServer();
var clientsocket 

if(NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

app.listen(PORT, ()=> console.log(`LISTENING @ http://127.0.0.1:${PORT}`))

app.get('*', setFileMeta, setDirDetails, sendHeaders, (req, res) => {
  console.log(res.body)
  if(res.body) {
    if(req.get('Accept') === 'application/x-gtar') {
       console.log(req.get('Accept'))
       res.setHeader('Content-Type', 'application/x-gtar')
       var archive = archiver.create('zip', {})
       archive.pipe(res)
       archive.bulk([{ 
          expand: true,
          cwd: SERVER_DIR, 
          src: ['**/*'] 
       }]).finalize()
    } else {
       res.json(res.body)
    }
    return  
  }
  fs.createReadStream(req.filePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, (req, res, next) => {
 (async () => {
    if(!req.stat) return res.status(400).send('Invalid path')
    if(req.stat.isDirectory()) {
       await rimraf.promise(req.filePath)
    } else {
       await fs.promise.unlink(req.filePath)
    }
    res.end()
    
    //notify the tcp client
    if(clientsocket) {
      clientsocket.sendMessage({verb: 'delete', path: req.url})   
    }
  })().then(() => next())
})
    

app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
  (async () => {
     if(req.stat) return res.status(405).send('File exists')
     await mkdirp.promise(req.dirPath)
  
     if(!req.isDir) {
        req.pipe(fs.createWriteStream(req.filePath))
        //notify the tcp client
        if(clientsocket) {
           clientsocket.sendMessage({verb: 'update', path: req.url, body: req.body})
           console.log("send creat/update to client: " + req.url + " body:" + req.body)
        }
     } else {
        //notify the tcp client
        if(clientsocket) {
           clientsocket.sendMessage({verb: 'mkdir', path: req.url})
           console.log("send creat/update to client: " + req.url)
        }
     }
 
     res.end()
   })().then(() => next())
})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
  (async () => {
    if(!req.stat) return res.status(405).send('File does not exist')
    if(req.isDir) return res.status(405).send('Path is a directory')
  
    await fs.promise.truncate(req.filePath, 0)
    req.pipe(fs.createWriteStream(req.filePath))

    //notify the tcp client
    if(clientsocket) {
      console.log(req.body)
      clientsocket.sendMessage({verb: 'update', path: req.filePath, body: req.body})
    }
    res.end()
  })().then(() => next())
})

function setDirDetails(req, res, next) {
  let filePath = req.filePath
  let endsWithSlash = filePath.charAt(filePath.length - 1) === path.sep
  let hasExt = path.extname(filePath) !== ''
  req.isDir = endsWithSlash || !hasExt
  req.dirPath = req.isDir ? filePath : path.dirname(filePath)
  next()
}

function setFileMeta(req, res, next) {
  req.filePath = path.resolve(path.join(SERVER_DIR, req.url))
  if(req.filePath.indexOf(SERVER_DIR) !== 0) {
     res.status(400).send('Invalid path')
     return
  }
  fs.promise.stat(req.filePath).then(stat => req.stat = stat, ()=> req.stat = null).nodeify(next)
}

function sendHeaders(req, res, next) {
  (async () => {
    if(req.isDir) {
      let files = await fs.promise.readdir(req.dirPath)
      res.body = JSON.stringify(files)
      res.setHeader('Content-Length', res.body.length)
      res.setHeader('Content-Type', 'application/json')
    } else {
      res.setHeader('Content-Length', req.stat.size)
      let contentType = mime.contentType(path.extname(req.filePath))
      res.setHeader('Content-Type', contentType)
    }
  })().then(() => next())
}

//start the tcp server
server.on('connection', function(socket) { //This is a standard net.Socket
    clientsocket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket
    clientsocket.on('message', function(message) {
        if(message.verb === 'init') {
           clientsocket.sendMessage({verb: init, body: {}})
        }
    });
});

console.log('TCP server listening on ' +  TCP_PORT);
server.listen(TCP_PORT);
