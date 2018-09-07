const debug = require('debug')('gwtcp2:tcp:cmd')
let status = 'ON'

module.exports = (app) => {
  const cmd = {}

  cmd.check = (imei, socket, cb) => {
    debug('cmd.check', imei)
    const device = app.cache.get(imei)
    if (!device) cb(new Error('Not a valid device'))
    const Cmds = app.db.collection('cmds')
    Cmds.find({
      _device: device._id,
      _account: device._account,
      status: 'pending'
    }).toArray((err, docs) => {
      if (err) return cb(err)
      cb(null)
      // TODO: si hay algo escribimos en el socket
      status = (status === 'ON') ? 'OFF' : 'ON'
      socket.write(`#IO6|${status}$\n`)
    })
  }

  app.cmd = cmd
}
