const path = require('path')

const app = {}
app.conf = require(path.join(__dirname, 'src/conf'))

// Conectamos a DB. El Callback indica que la conexión se ha realizado
// Esperamos a que se inicie la DB para iniciar el resto de componentes
require(path.join(__dirname, 'src/db'))(app, () => {
  require(path.join(__dirname, 'src/shutdown-clean'))(app)
  require(path.join(__dirname, 'src/io'))(app)
  require(path.join(__dirname, 'src/cache'))(app)
  require(path.join(__dirname, 'src/tcp-parse-data'))(app)
  require(path.join(__dirname, 'src/tcp-send-cmd'))(app)
  require(path.join(__dirname, 'src/utils'))(app)
  require(path.join(__dirname, 'src/insert-position'))(app)
  require(path.join(__dirname, 'src/tcp'))(app)
})
