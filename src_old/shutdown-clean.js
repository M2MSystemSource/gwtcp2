process.stdin.resume()

module.exports = (app) => {

  function exitHandler (options, exitCode) {
    if (options.cleanup) {
      console.log('clean', options)
      console.log('exitCode', exitCode)
      app.tcp.eachClient((deviceId, client) => {
        if (!client.socket) return
        app.io.local.emit('gwtcp2/shutdown', {imei: client.imei})
        client.socket.destroy()
      })
    }

    if (options.exit) process.exit()
  }

  process.on('exit', () => {
    console.log('BECAUSE EXIT')
    exitHandler({cleanup: true})
  })

  process.on('SIGINT', () => {
    console.log('BECAUSE SIGINT')
    exitHandler({exit: true})
  })

  process.on('SIGUSR1', () => {
    console.log('BECAUSE SIGUSR1')
    exitHandler({exit: true})
  })
  process.on('SIGUSR2', () => {
    console.log('BECAUSE SIGUSR2')
    exitHandler({exit: true})
  })

  process.on('uncaughtException', (err) => {
    console.log('BECAUSE uncaughtException', err)
    exitHandler({exit: true})
  })
}
