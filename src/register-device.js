const waterfall = require('async/waterfall')
const shortid = require('shortid')

module.exports = (app) => {
  let self = {}

  const dbDevice = app.db.collection('devices')
  const dbSim = app.db.collection('sims')

  const invalidNames = ['RHJEN', 'RH980', 'RH900', 'RH777', 'RH778']

  const simDocBase = {
    _id: null,
    _account: 'ryz4-VuSV',
    name: '',
    _sim: null,
    color: '#ff0000',
    customName: '',
    freeze: false,
    version: 2,
    bidirectional: true,
    tracking: {},
    sensing: {}
  }

  self.run = (imei, iccid, cb) => {
    let simId = null

    waterfall([
      // comprobar si existe el imei
      (callback) => {
        dbDevice.findOne({_id: imei})
        .then((doc) => {
          if (doc) {
            // no podemos dar de alta un IMEI que existe
            return callback(new Error('El dipositivo (IMEI) ya existe'))
          }
          callback()
        })
      },

      (callback) => {
        dbSim.findOne({iccid})
          .then((doc) => {
            // la sim debe existir
            if (!doc) {
              return callback(new Error('La SIM (ICCID) NO existe'))
            }
            simId = doc._id
            callback()
          })
      },

      // obtenemos el nuevo nombre del device
      (callback) => {
        dbDevice.find({name: /^RH/}, {sort: [['name', -1]]})
          .limit(20)
          .toArray((err, docs) => {
            if (err) return callback(err)
            let prevNumber = 0
            let number = 0

            docs.forEach((doc) => {
              if (invalidNames.indexOf(doc.name) >= 0) return
              let docNumber = parseInt(doc.name.replace('RH', ''), 10)
              if (docNumber > prevNumber) {
                prevNumber = docNumber
                number = docNumber + 1
              }
            })

            let count = 0
            while (invalidNames.indexOf('RH' + number) >= 0) {
              number++
              count++
              if (count > 10) {
                cb(new Error('NO HAY NOMBRE'))
                break
              }
            }

            callback(null, number)
          })
      },

      // creamos el device
      (deviceNumber, callback) => {
        const device = JSON.parse(JSON.stringify(simDocBase))

        device._id = imei
        device.name = `RH${deviceNumber}`
        device._sim = simId

        console.log('device', device)

        dbDevice.insertOne(device, (err, r) => {
          if (err) return cb(err)
          cb(null, device.name)
        })
      }
    ], (err, result) => {
      if (err) return cb(err)
      cb(null, result)
    })
  }

  return self
}
