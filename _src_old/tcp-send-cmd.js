/**
 * Comprueba si un dispositivo tiene algún comando pendiente de envío.
 */

const debug = require('debug')('gwtcp2:tcp:cmd')

module.exports = (app) => {
  const Cmds = app.db.collection('cmds')
  const self = {}

  self.updateCmd = (cmdId, data) => {
    Cmds.updateOne(
      {_id: cmdId},
      {$set: data},
      {upsert: true},
      (err) => {
        if (err) debug(err)
      }
    )
  }

  self.check = (imei, socket, cb) => {
    const device = app.cache.get(imei)
    if (!device) cb(new Error('Not a valid device'))

    Cmds.findOne({
      _device: device._id,
      _account: device._account,
      status: 'pending'
    }, (err, cmd) => {
      if (err) return cb(err)
      if (!cmd) {
        console.log(1)
        return cb(null)
      }

      console.log('cmd', cmd)

      if (cmd.timeout > 0) {
        if ((Date.now - cmd.createAt) > cmd.timeout) {
          debug(`${imei} -> cmd timeout`)
          self.updateCmd(cmd._id, {status: 'timeout'})
          return cb(null)
        }
      }

      debug(`write -> ${cmd._id}=${cmd.cmd}`)
      socket.write(`${cmd._id}=${cmd.cmd}\n`)
      self.updateCmd(cmd._id, {sent: Date.now()})
      cb(null)
    })
  }

  self.setDone = (cmdId) => {
    self.updateCmd(cmdId, {status: 'done', ack: Date.now()})
  }

  app.cmd = self
}
