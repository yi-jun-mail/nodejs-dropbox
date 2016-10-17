var buf = Buffer.from("hello world", "utf8")
console.log(buf.toString('base64'));
console.log(buf.toString('ascii'));
console.log(buf.toString('utf8'));

var base64buf = buf.toString('base64')
var decodebuf = Buffer.from(base64buf, 'base64')
var buf1 = decodebuf.toString('utf8')
console.log(buf1)
