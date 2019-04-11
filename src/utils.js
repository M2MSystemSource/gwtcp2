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
    const year = parseInt(date.substr(0, 4), 10)
    const month = parseInt(date.substr(4, 2), 10)
    const day = parseInt(date.substr(6, 2), 10)
    const hours = parseInt(date.substr(8, 2), 10)
    const minutes = parseInt(date.substr(10, 2), 10)
    const seconds = parseInt(date.substr(12, 2), 10)

    return Date.UTC(year, month - 1, day, hours, minutes, seconds)
  }

  self.simcomGSMDateTimeToTimestamp = (date) => {
    const year = parseInt(date.substr(0, 2), 10) + 2000
    const month = date.substr(2, 2)
    const day = date.substr(4, 2)
    const hours = date.substr(6, 2)
    const minutes = date.substr(8, 2)
    const seconds = date.substr(10, 2)
    const timezone = date.substr(12, 2) / 4

    const dateString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-0200`
    console.log(dateString)
    const d = new Date(dateString)
    return d
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
