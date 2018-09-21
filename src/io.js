var io = require('socket.io-client')

module.exports = (app) => {
  const self = {}

  self.local = io.connect(app.conf.ioUrl, {reconnect: true})

  self.local.on('connect', function () {
    console.log('- Socket.io Connected -')
  })

  app.io = self
}
