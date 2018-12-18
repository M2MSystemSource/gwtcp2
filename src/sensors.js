const path = require('path')
const fs = require('fs')

module.exports = (app) => {
  const sensorsFolder = path.join(__dirname, 'sensors')

  app.sensors = {}

  fs.readdir(sensorsFolder, (err, files) => {
    if (err) throw err
    files.forEach(file => {
      let filename = file.split('.')[0]
      let sensorPath = path.join(sensorsFolder, file)
      app.sensors[filename] = require(sensorPath)(app)
    })

    app.emit('sensors-ready')
  })
}
