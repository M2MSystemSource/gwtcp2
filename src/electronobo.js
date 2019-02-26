const debug = require('debug')('gwtcp2:electronobo')
const request = require('request')

const waterfall = require('async/waterfall')

const usersUrl = 'http://regbenimodo.dyndns.org/API2/usuariosSurtidor.php?accion=peticionListado'
let _USERS = {}
let _COUNT = 0
const usersIntervalUpdate = 1000 * 60 * 60 * 1

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

  self.createSession = (orgData, cb) => {
    debug('Create Electronobo Session')
    debug(JSON.stringify(orgData.request))

    const data = self.clearData(orgData.request)
    if (!data) return cb(new Error('no-auth-bad-data'))

    if (!self.valdiateUserPass(data.user, data.pass)) {
      return cb(new Error('no-auth-bad-user-pass'))
    }

    let litresNumber = parseInt(data.litres, 10)
    if (litresNumber < 0 || litresNumber > 1000) {
      return cb(new Error('no-auth-bad-litres'))
    }

    waterfall([
      (cb) => self.getNewSessioNumber(cb),
      (opNumber, callback) => {
        if (!opNumber) return cb(null)
        dbEnobo.insertOne({
          _id: opNumber,
          user: data.user,
          pass: data.pass,
          litres: data.litres,
          totalLitres: data.litres,
          dateStart: Date.now(),
          dateEnd: 0
        }, (err, doc) => {
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

  // recibimos un array tipo: [ 'u:1111', 'p:5555', 'l:2222' ]
  // validamos y convertimos a objeto {user: , pass: , litros: }
  self.clearData = (orgData) => {
    if (orgData.length !== 3) return false

    const data = {
      user: orgData[0].replace('u:', ''),
      pass: orgData[1].replace('p:', ''),
      litres: orgData[2].replace('l:', '')
    }

    return data
  }

  self.updateUsersList()
  setInterval(self.updateUsersList, usersIntervalUpdate)

  app.electronobo = self
}
