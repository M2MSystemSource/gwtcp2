var io = require('socket.io-client')

module.exports = (app) => {
  const socket = io.connect(app.conf.ioUrl, {reconnect: true})
  const self = {}

  socket.on('connect', function (socket) {
    console.log('- Socket.io Connected -')
  })

  self.emit = (channel, data) => {
    socket.emit(channel, data)
  }

  app.io = self
}
