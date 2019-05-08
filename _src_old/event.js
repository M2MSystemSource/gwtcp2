/**
 * Un pequeño sistema de eventos pub/sub para gestionar el envío de comandos
 * y los ack devueltos por los dispositivos.
 *
 * No es un pub/sub generico exportable a otras aplicaciones, se ha ajustado su
 * funcionamiento para consumir los recursos mínimos
 */

const app = {}
const events = {}

/**
 * Solo se permite un callback por evento. Es una limitación impuesta a proposito.
 *
 * @param {String} eventName
 * @param {function} callback
 */
app.on = (eventName, callback) => {
  events[eventName] = callback
}

app.emit = (eventName, ...args) => {
  if (!events[eventName]) return
  events[eventName]()
}

app.off = (eventName) => {
  if (!events[eventName]) return
  delete events[eventName]
  events[eventName] = null
}

module.exports = app
