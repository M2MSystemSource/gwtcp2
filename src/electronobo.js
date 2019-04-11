const debug = require('debug')('gwtcp2:electronobo')
const request = require('request')

const waterfall = require('async/waterfall')

const usersUrl = 'http://regbenimodo.dyndns.org/API2/usuariosSurtidor.php?accion=peticionListado'
let _USERS = {}
let _COUNT = 0
const usersIntervalUpdate = 1000 * 60 * 60 * 1
const litresMax = 5000
const litresMin = 10

module.exports = (app) => {
  const self = {}
  const dbCounter = app.db.collection('counters')
  const dbEnobo = app.db.collection('enobo')

  self.getNewSessioNumber = (cb) => {
    /*
    // formato de documento
    {
        "_id" : "electronobo",
        "counter" : 1000
    }
    */

    dbCounter.findOneAndUpdate(
      {_id: 'electronobo'},
      {$inc: {counter: 1}},
      {new: true},
      (err, doc) => {
        if (err) return cb(err)
        return cb(null, doc.value.counter)
      })
  }

  self.createSession = (data, cb) => {
    debug('Create Electronobo Session')

    if (!self.valdiateUserPass(data.user, data.pass)) {
      return cb(new Error('no-auth-bad-user-pass'))
    }

    let litresNumber = parseInt(data.litres, 10)
    if (litresNumber < litresMin || litresNumber > litresMax) {
      return cb(new Error('no-auth-bad-litres'))
    }

    waterfall([
      (cb) => self.getNewSessioNumber(cb),
      (opNumber, callback) => {
        if (!opNumber) return cb(null)

        const session = {
          // _id: opNumber,
          _id: 22222,
          _device: data.imei,
          user: data.user,
          pass: data.pass,
          litres: data.litres,
          totalLitres: 0,
          dateStart: Date.now(),
          dateEnd: 0
        }

        dbEnobo.insertOne(session, (err, doc) => {
          if (err) return cb(err)
          if (!doc) return cb()
          callback(null, doc.ops[0]._id)
        })
      }
    ], cb)
  }

  self.terminateSession = (opNumber, litres, cb) => {
    waterfall([
      (callback) => { dbEnobo.findOne({_id: parseInt(opNumber)}, callback) },
      (doc, callback) => {
        if (!doc) return cb(new Error('Not found'))
        dbEnobo.findOneAndUpdate(
          {_id: parseInt(opNumber)},
          {$set: {
            dateEnd: Date.now(),
            totalLitres: parseInt(litres)
          }},
          { upsert: true },
          callback
        )
      }
    ], cb)
  }

  self.updateUsersList = () => {
    request(usersUrl, function (err, response, body) {
      if (err) return console.log(err)
      if (response.statusCode >= 400) {
        return console.log('Electronobo bad response %s', response.statusCode)
      }

      try {
        const json = JSON.parse(body)
        _USERS = {} // reset
        _COUNT = 0
        json.forEach((user) => {
          if (user.ID_USUARIO.length === 4) {
            _USERS[user.ID_USUARIO] = user.PIN
            _COUNT++
          }
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
