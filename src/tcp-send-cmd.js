const debug = require('debug')('gwtcp2:tcp-send-cmd')

module.exports = (app) => {
  const cmd = {}

  cmd.check = (client, cb) => {
    const device = app.cache.get(client.imei)
    if (!device) cb(new Error('Not a valid device'))
    const Cmds = app.db.collection('cmds')
    Cmds.find({
      _device: device._id,
      _account: device._account,
      status: 'pending'
    }).toArray((err, docs) => {
      if (err) return cb(err)
    })
  }

  app.cmd = cmd
}
