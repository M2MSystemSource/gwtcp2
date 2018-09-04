module.exports = (app) => {
  const data = {}
  data.regex = {}

  data.regex.isGretting = /^8[0-9]{14}$/gi
  data.regex.isOpAuto = /^8[0-9]{14}\|1,[0-9\-,.]*\|[0-9]{1,4},[0-9]{1,4}$/gi
  data.regex.isAutoBatt = /^8[0-9]{14}\|0|[0-9]{1,4},[0-9]{1,4}$/gi
  data.regex.isOpTcp = /^1,[0-9\-,.]*\|[0-9]{1,4},[0-9]{1,4}$/gi
  data.regex.isTcpBatt = /^0|[0-9]{1,4},[0-9]{1,4}$/gi
  data.regex.isAck = /ack/

  data.parse = (data) => {

  }

  app.data = data
}
