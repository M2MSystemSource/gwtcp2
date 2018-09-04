const net = require('net')
const clients = {}

module.exports = (app) => {
  net.createServer((socket) => {
    console.log('new connection: ' + socket.remoteAddress + ':' + socket.remotePort)

    socket.on('data', (data) => {

    })

    // Add a 'close' event handler to this instance of socket
    socket.on('close', (data) => {
      console.log('CLOSED: ' + socket.remoteAddress + ' ' + socket.remotePort)
    })
  }).listen(app.conf.tcpPort)

  console.log('Server listening on port ' + app.conf.tcpPort)
}
