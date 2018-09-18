const express = require('express')
const app = express()
const port = process.env.HTTP_PORT

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`HTTP app listening on port ${port}!`))
