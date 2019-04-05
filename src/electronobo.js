const debug = require('debug')('gwtcp2:electronobo')
const request = require('request')
const usersUrl = 'http://regbenimodo.dyndns.org/API2/usuariosSurtidor.php?accion=peticionListado'
let _USERS = {}
let _COUNT = 0
const usersIntervalUpdate = 1000 * 60 * 60 * 1

module.exports = (app) => {
  const self = {}
  const dbCounter = app.db.collection('counters')

  self.getNewSessioNumber = (cb) => {
    dbCounter.findOneAndUpdate(
      {_id: 'electronobo'},
      {$inc: {counter: 1}},
      {new: true},
      (err, doc) => {
        if (err) return cb(err)
        return cb(null, doc.counter)
      })
  }

  self.createSession = (user, pass, litres, cb) => {
    debug('Create Electronobo Session')

    if (self.valdiateUserPass(user, pass)) {
      return cb(new Error('no-auth'))
    }

    let litresNumber = parseInt(litres, 10)
    if (litresNumber < 0) {
      return cb(new Error('no-auth'))
    }

    self.getNewSessioNumber(cb)
  }

  self.updateUsersList = () => {
    request(usersUrl, function (err, response, body) {
      if (err) return console.log(err)
      if (response.statusCode >= 400) return console.log('Electronobo bad response %s', response.statusCode)

      try {
        const json = JSON.parse(body)
        _USERS = {} // reset
        _COUNT = 0
        json.forEach((user) => {
          _USERS[user.ID_USUARIO] = user.PIN
          _COUNT++
        })

        debug(`Electronobo users updated - total %s users`, _COUNT)
      } catch (e) {
        console.log('Parse error | users electronobo', e)
      }
    })
  }

  self.valdiateUserPass = (user, pass) => {
    if (user.length !== 4 || pass.length !== 4) return false
    if (!_USERS.hasOwnProperty(user)) return false
    if (_USERS[user] !== pass) return false

    return true
  }

  self.updateUsersList()
  setInterval(self.updateUsersList, usersIntervalUpdate)

  app.electronobo = self
}
