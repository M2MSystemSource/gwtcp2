/**
 * Comprueba si un dispositivo tiene algún comando pendiente de envío.
 */

const debug = require('debug')('gwtcp2:tcp:cmd')

module.exports = (app) => {
  const cmd = {}

  cmd.check = (imei, socket, cb) => {
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
    })
  }
  app.cmd = cmd
}
