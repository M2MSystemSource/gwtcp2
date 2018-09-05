const debug = require('debug')('gwtcp2:utils')

module.exports = (app) => {
  const utils = {}

  /**
   * Recibe una fecha en formato simcom y lo devuelve como unix timestamp GMT0
   * Formato de entrada: YYYYMMDDHHYYSS.mmm
   *
   * En principio el simcom obtiene las fechas en formato GMT0, utilizamos
   * el método `Date.UTC()` para convertirlo en timestamp GMT+0
   *
   * @param {String} data
   */
  utils.simcomDateTimeToTimestamp = (data) => {
    const year = parseInt(data.substr(0, 4), 10)
    const month = parseInt(data.substr(4, 2), 10)
    const day = parseInt(data.substr(6, 2), 10)
    const hours = parseInt(data.substr(8, 2), 10)
    const minutes = parseInt(data.substr(10, 2), 10)
    const seconds = parseInt(data.substr(12, 2), 10)

    return Date.UTC(year, month - 1, day, hours, minutes, seconds)
  }
}
