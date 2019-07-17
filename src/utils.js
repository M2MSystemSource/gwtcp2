module.exports = (app) => {
  const self = {}

  /**
   * Recibe una fecha en formato simcom GPS y lo devuelve como unix timestamp
   * GMT0. Formato de entrada: YYYYMMDDHHYYSS.mmm
   *
   * Esta es la fecha GPS obtenida con el comando "AT+CGNSINF". No confundir con
   * la fecha GSM obtenida con el comando "AT+CCLK?"
   *
   * @param {String} date YYYYMMDDhhmmss.zzz
   */
  self.simcomDateTimeToTimestamp = (date) => {
    let year = parseInt(date.substr(0, 4), 10)
    let month = parseInt(date.substr(4, 2), 10)
    let day = parseInt(date.substr(6, 2), 10)
    let hours = parseInt(date.substr(8, 2), 10)
    let minutes = parseInt(date.substr(10, 2), 10)
    let seconds = parseInt(date.substr(12, 2), 10)

    return Date.UTC(year, month - 1, day, hours, minutes, seconds)
  }

  /**
   * Entra un valor numerico, como 2, pero DateTime no entiende este valor como
   * timezone de un datestring, convertimos a 0200. Si entra 20, convertimos a
   * 2000
   *
   * @return {String} El valor compatible con datestring, tipo "0200" o "2000"
   */
  const number2timezone = (number) => {
    let timezone = parseInt(number, 10) * 100
    if (timezone < 1000) {
      return '0' + timezone
    }
    return '' + timezone
  }

    /**
     * Parsea una fecha y hora según el formato (YYMMDDHHmmSSZZ) utilizado
     * por los modem SIMCOM (comando AT+CCLK) para obtener hora de red GSM
     */
  self.simcomGSMDateTimeToTimestamp = (date) => {
    let year = parseInt(date.substr(0, 2), 10) + 2000
    let month = date.substr(2, 2)
    let day = date.substr(4, 2)
    let hours = date.substr(6, 2)
    let minutes = date.substr(8, 2)
    let seconds = date.substr(10, 2)
    let timezone = number2timezone(parseInt(date.substr(12, 2)) / 4)

    console.log('timezone', timezone)

    let dateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+${timezone}`

    console.log('dateString', dateString)

    return new Date(dateString)
  }

  /**
   * Recibe una trama de sensing y extrae la fecha.
   *
   * En una trama pueden haber hasta 3 tipos de fecha, GPS, GSM y RTC.
   * A partir de Trackio 0.4.0b3 se están elimando las dos primeras, para
   * mantener solo el tipo RTC, que viene a ser un unix timestamp en segundos
   * (11 dígitos)
   *
   * @param {Object} sensing
   * @return {Number} Unix timestamp en millis
   */
  self.parseSensingDate = (sensing) => {
    if (sensing.time) {
      if (!isNaN(sensing.time) && sensing.time.length === 10) {
        return parseInt(sensing.time, 10) * 1000
      } else {
        let date = self.simcomDateTimeToTimestamp(sensing.gtime)
        if (!date) return Date.now()
        return date.getTime() || Date.now()
      }
    }

    if (sensing.gtime) {
      let date = self.simcomGSMDateTimeToTimestamp(sensing.gtime)
      return date.getTime() || Date.now()
    }

    // ninguna de las anteriores, usamos fecha actual del server
    return Date.now()
  }

  /**
   * La respuesta base que se debe dar a cualquier petición válida "OK".
   * Pasamos además \r\n para saltos de línea y posibilidad de un dato extra.
   */
  self.sayOk = (socket, data = null) => {
    let OK = 'OK'
    if (data) OK += `|${data}`
    socket.write(`${OK}\r\n`)
  }

  self.sayKo = (socket, data = null) => {
    let KO = 'KO'
    if (data) KO += `|${data}`
    socket.write(`${KO}\r\n`)
  }

  app.utils = self
}
