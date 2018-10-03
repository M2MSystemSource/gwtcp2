process.stdin.resume()

module.exports = (app) => {

  function exitHandler (options, exitCode) {
    if (options.cleanup) {
      console.log('clean')
      app.tcp.eachClient((deviceId, client) => {
        if (!client.socket) return
        app.io.local.emit('gwtcp2/shutdown', {imei: client.imei})
        client.socket.destroy()
      })
    }

    if (options.exit) process.exit()
  }

  process.on('exit', exitHandler.bind(null, {cleanup: true}))

  process.on('SIGINT', exitHandler.bind(null, {exit: true}))

  process.on('SIGUSR1', exitHandler.bind(null, {exit: true}))
  process.on('SIGUSR2', exitHandler.bind(null, {exit: true}))

  process.on('uncaughtException', exitHandler.bind(null, {exit: true}))
}
